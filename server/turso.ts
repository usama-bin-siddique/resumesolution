import {createClient, type Client, type InValue, type ResultSet} from '@libsql/client/web';
import type {Database,Statement} from '../worker/shared.ts';
import {migrations} from './migrations.ts';

const result=(r:ResultSet)=>({results:r.rows.map(row=>({...row})),meta:{changes:r.rowsAffected}});
export function adaptDatabase(client:Client):Database {
 const statements=new WeakMap<Statement,{sql:string,args:InValue[]}>();
 function prepare(sql:string):Statement {
  const query={sql,args:[] as InValue[]};
  const statement:Statement={
   bind(...args:unknown[]){return bound(sql,args as InValue[])},
   async first(){return result(await client.execute(query)).results[0]??null},
   async all(){return result(await client.execute(query))},
   async run(){return result(await client.execute(query))},
  };
  statements.set(statement,query);return statement;
 }
 function bound(sql:string,args:InValue[]){const s=prepare(sql);statements.get(s)!.args=args;return s}
 return {prepare,async batch(batch){
  const queries=batch.map(s=>{const q=statements.get(s);if(!q)throw new Error('Foreign database statement');return q});
  return (await client.batch(queries,'write')).map(result);
 }};
}

export async function migrateDatabase(client:Client){
 await client.execute('CREATE TABLE IF NOT EXISTS _globalcv_migrations (name TEXT PRIMARY KEY NOT NULL)');
 // Write transactions serialize competing cold starts. A failed migration is rolled back.
 for(const migration of migrations){
  const transaction=await client.transaction('write');
  try{
   const existing=await transaction.execute({sql:'SELECT name FROM _globalcv_migrations WHERE name=?',args:[migration.name]});
   if(!existing.rows.length){
    for(const sql of migration.sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await transaction.execute(sql);
    await transaction.execute({sql:'INSERT INTO _globalcv_migrations(name) VALUES (?)',args:[migration.name]});
   }
   await transaction.commit();
  }finally{transaction.close()}
 }
}
let ready:Promise<Database>|undefined;
export function getDatabase(){
 if(!ready)ready=(async()=>{
  const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
  if(!url||!authToken)throw new Error('DATABASE_NOT_CONFIGURED');
  if(!/^(libsql|https):\/\//.test(url))throw new Error('DATABASE_URL_INVALID');
  const client=createClient({url,authToken});
  try{await migrateDatabase(client);return adaptDatabase(client)}catch(error){client.close();throw error}
 })().catch(error=>{ready=undefined;throw error});
 return ready;
}
