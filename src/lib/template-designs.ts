export function templateDesign(id:string,accent:string){
 const designs:Record<string,any>={
 banner:{header:{backgroundColor:accent,padding:18,borderBottomWidth:0},name:{color:'#ffffff',fontSize:29},role:{color:'#ffffff'},contact:{color:'#ffffff'},heading:{borderBottomWidth:2,borderBottomColor:accent,letterSpacing:1.5}},
 linen:{font:'serif',page:{lineHeight:1.65},header:{borderBottomWidth:0,paddingBottom:20},name:{fontSize:30,fontWeight:400,color:'#28332d'},heading:{fontWeight:400,fontSize:13,letterSpacing:0,borderBottomWidth:0.5,borderBottomColor:accent},section:{marginTop:23}},
 axis:{header:{borderLeftWidth:6,borderLeftColor:accent,paddingLeft:17,borderBottomWidth:0},name:{fontSize:27},heading:{borderLeftWidth:3,borderLeftColor:accent,paddingLeft:9,borderBottomWidth:0},section:{marginTop:19}},
 folio:{font:'serif',header:{alignItems:'center',borderTopWidth:1,borderTopColor:accent,borderBottomWidth:1,paddingTop:16},name:{fontSize:30,fontWeight:400,letterSpacing:2},contact:{textAlign:'center'},heading:{textAlign:'center',fontWeight:400,letterSpacing:2,borderBottomWidth:0},section:{marginTop:22}},
 technical:{font:'mono',header:{borderBottomWidth:2,borderBottomColor:accent},name:{fontSize:24,fontWeight:700},role:{fontSize:11},heading:{fontSize:10,letterSpacing:0,borderBottomWidth:1,borderBottomColor:accent},section:{marginTop:14}},
 ribbon:{header:{borderBottomWidth:0},name:{fontSize:28,color:'#28332d'},heading:{backgroundColor:accent,color:'#ffffff',padding:6,borderBottomWidth:0,letterSpacing:1},section:{marginTop:19}},
 signature:{font:'serif',header:{borderBottomWidth:0},name:{fontSize:34,fontWeight:400},role:{fontSize:13},heading:{fontSize:12,fontWeight:400,letterSpacing:0,borderBottomWidth:0,borderTopWidth:1,borderTopColor:accent,paddingTop:8},section:{marginTop:20}},
 outline:{header:{borderWidth:1,borderColor:accent,padding:16},name:{fontSize:26},heading:{borderWidth:0.5,borderColor:accent,padding:5,letterSpacing:1},section:{marginTop:19}},
 minimal:{header:{borderBottomWidth:0,paddingBottom:6},name:{fontSize:25,color:'#28332d'},role:{fontSize:11},heading:{color:'#28332d',fontSize:9,letterSpacing:2,borderBottomWidth:0},section:{marginTop:22},page:{lineHeight:1.6}}
 };return designs[id]||{};
}
