import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
export function openDatabase(filename='.sites-runtime/globalcv.sqlite'){
 if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
 const sql=new DatabaseSync(filename);sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
 const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
 for(const entry of journal.entries){if(sql.prepare('SELECT name FROM _local_migrations WHERE name=?').get(entry.tag))continue;sql.exec('BEGIN');try{sql.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),'utf8'));sql.prepare('INSERT INTO _local_migrations VALUES (?)').run(entry.tag);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}
 function prepare(query){let params=[];const statement={bind(...values){params=values;return statement},async first(){return sql.prepare(query).get(...params)||null},async all(){return {results:sql.prepare(query).all(...params)}},async run(){return execute()},execute};function execute(){return {meta:{changes:Number(sql.prepare(query).run(...params).changes)}}}return statement;}
 const DB={prepare,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
 return {DB,sql};
}
