(function(a){if(typeof module==="object"&&module.exports){module.exports=a()
}else{var b=window.Granite=window.Granite||{};
b.Sling=a()
}}(function(){return{SELECTOR_INFINITY:".infinity",CHARSET:"_charset_",STATUS:":status",STATUS_BROWSER:"browser",OPERATION:":operation",OPERATION_DELETE:"delete",OPERATION_MOVE:"move",DELETE_SUFFIX:"@Delete",TYPEHINT_SUFFIX:"@TypeHint",COPY_SUFFIX:"@CopyFrom",MOVE_SUFFIX:"@MoveFrom",ORDER:":order",REPLACE:":replace",DESTINATION:":dest",SAVE_PARAM_PREFIX:":saveParamPrefix",IGNORE_PARAM:":ignore",REQUEST_LOGIN_PARAM:"sling:authRequestLogin",LOGIN_URL:"/system/sling/login.html",LOGOUT_URL:"/system/sling/logout.html"}
}));
(function(a){if(typeof module==="object"&&module.exports){module.exports=a()
}else{var b=window.Granite=window.Granite||{};
b.Util=a()
}}(function(){var a=function(b){return Object.prototype.toString.call(b)==="[object Array]"
};
return{patchText:function(d,c){if(c){if(!a(c)){d=d.replace("{0}",c)
}else{for(var b=0;
b<c.length;
b++){d=d.replace(("{"+b+"}"),c[b])
}}}return d
},getTopWindow:function(){var c=window;
if(this.iFrameTopWindow){return this.iFrameTopWindow
}try{while(c.parent&&c!==c.parent&&c.parent.location.href){c=c.parent
}}catch(b){}return c
},setIFrameMode:function(b){this.iFrameTopWindow=b||window
},applyDefaults:function(){var d;
var f=arguments[0]||{};
for(var c=1;
c<arguments.length;
c++){d=arguments[c];
for(var b in d){var e=d[b];
if(d.hasOwnProperty(b)&&e!==undefined){if(e!==null&&typeof e==="object"&&!(e instanceof Array)){f[b]=this.applyDefaults(f[b],e)
}else{if(e instanceof Array){f[b]=e.slice(0)
}else{f[b]=e
}}}}}return f
},getKeyCode:function(b){return b.keyCode?b.keyCode:b.which
}}
}));
(function(a){if(typeof module==="object"&&module.exports){module.exports=a(require("@granite/util"),require("jquery"))
}else{window.Granite.HTTP=a(Granite.Util,jQuery)
}}(function(util,$){return(function(){var contextPath=null;
var SCRIPT_URL_REGEXP=/^(?:http|https):\/\/[^/]+(\/.*)\/(?:etc\.clientlibs|etc(\/.*)*\/clientlibs|libs(\/.*)*\/clientlibs|apps(\/.*)*\/clientlibs|etc\/designs).*\.js(\?.*)?$/;
var ENCODE_PATH_REGEXP=/[^\w-.~%:/?[\]@!$&'()*+,;=]/;
var URI_REGEXP=/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
var loginRedirected=false;
var self={};
self.getSchemeAndAuthority=function(uri){if(!uri){return""
}var result=URI_REGEXP.exec(uri);
if(result===null){return""
}return[result[1],result[3]].join("")
};
self.getContextPath=function(){if(contextPath===null){contextPath=self.detectContextPath()
}return contextPath
};
self.detectContextPath=function(){try{if(window.CQURLInfo){contextPath=CQURLInfo.contextPath||""
}else{var scripts=document.getElementsByTagName("script");
for(var i=0;
i<scripts.length;
i++){var result=SCRIPT_URL_REGEXP.exec(scripts[i].src);
if(result){contextPath=result[1];
return contextPath
}}contextPath=""
}}catch(e){}return contextPath
};
self.externalize=function(url){try{if(url.indexOf("/")===0&&self.getContextPath()&&url.indexOf(self.getContextPath()+"/")!==0){url=self.getContextPath()+url
}}catch(e){}return url
};
self.internalize=function(url,doc){if(url.charAt(0)==="/"){if(contextPath===url){return""
}else{if(contextPath&&url.indexOf(contextPath+"/")===0){return url.substring(contextPath.length)
}else{return url
}}}if(!doc){doc=document
}var docHost=self.getSchemeAndAuthority(doc.location.href);
var urlHost=self.getSchemeAndAuthority(url);
if(docHost===urlHost){return url.substring(urlHost.length+(contextPath?contextPath.length:0))
}else{return url
}};
self.getPath=function(url){if(!url){if(window.CQURLInfo&&CQURLInfo.requestPath){return CQURLInfo.requestPath
}else{url=window.location.pathname
}}else{url=self.removeParameters(url);
url=self.removeAnchor(url)
}url=self.internalize(url);
var i=url.indexOf(".",url.lastIndexOf("/"));
if(i!==-1){url=url.substring(0,i)
}return url
};
self.removeAnchor=function(uri){var fragmentIndex=uri.indexOf("#");
if(fragmentIndex>=0){return uri.substring(0,fragmentIndex)
}else{return uri
}};
self.removeParameters=function(uri){var queryIndex=uri.indexOf("?");
if(queryIndex>=0){return uri.substring(0,queryIndex)
}else{return uri
}};
self.encodePathOfURI=function(uri){var DELIMS=["?","#"];
var parts=[uri];
var delim;
for(var i=0,ln=DELIMS.length;
i<ln;
i++){delim=DELIMS[i];
if(uri.indexOf(delim)>=0){parts=uri.split(delim);
break
}}if(ENCODE_PATH_REGEXP.test(parts[0])){parts[0]=self.encodePath(parts[0])
}return parts.join(delim)
};
self.encodePath=function(uri){uri=encodeURI(uri);
uri=uri.replace(/%5B/g,"[").replace(/%5D/g,"]");
uri=uri.replace(/\?/g,"%3F");
uri=uri.replace(/#/g,"%23");
return uri
};
self.handleLoginRedirect=function(){if(!loginRedirected){loginRedirected=true;
alert(Granite.I18n.get("Your request could not be completed because you have been signed out."));
var l=util.getTopWindow().document.location;
l.href=self.externalize("/")+"?resource="+encodeURIComponent(l.pathname+l.search+l.hash)
}};
self.getXhrHook=function(url,method,params){method=method||"GET";
if(window.G_XHR_HOOK&&typeof G_XHR_HOOK==="function"){var p={url:url,method:method};
if(params){p.params=params
}return G_XHR_HOOK(p)
}return null
};
self.eval=function(response){if(typeof response!=="object"){response=$.ajax({url:response,type:"get",async:false})
}try{return eval("("+(response.body?response.body:response.responseText)+")")
}catch(e){}return null
};
return self
}())
}));
(function(a){if(typeof module==="object"&&module.exports){module.exports=a(require("@granite/http"))
}else{window.Granite.I18n=a(window.Granite.HTTP)
}}(function(a){return(function(){var b={};
var g="/libs/cq/i18n/dict.";
var j=".json";
var c=undefined;
var i=false;
var f=null;
var k={};
var e=false;
var d=function(l){if(e){return g+l+j
}var n;
var m=document.querySelector("html");
if(m){n=m.getAttribute("data-i18n-dictionary-src")
}if(!n){return g+l+j
}return n.replace("{locale}",encodeURIComponent(l)).replace("{+locale}",l)
};
var h=function(n,m){if(m){if(Array.isArray(m)){for(var l=0;
l<m.length;
l++){n=n.replace("{"+l+"}",m[l])
}}else{n=n.replace("{0}",m)
}}return n
};
k.LOCALE_DEFAULT="en";
k.PSEUDO_LANGUAGE="zz";
k.PSEUDO_PATTERN_KEY="_pseudoPattern_";
k.init=function(l){l=l||{};
this.setLocale(l.locale);
this.setUrlPrefix(l.urlPrefix);
this.setUrlSuffix(l.urlSuffix)
};
k.setLocale=function(l){if(!l){return
}c=l
};
k.getLocale=function(){if(typeof c==="function"){c=c()
}return c||document.documentElement.lang||k.LOCALE_DEFAULT
};
k.setUrlPrefix=function(l){if(!l){return
}g=l;
e=true
};
k.setUrlSuffix=function(l){if(!l){return
}j=l;
e=true
};
k.getDictionary=function(l){l=l||k.getLocale();
if(!b[l]){i=l.indexOf(k.PSEUDO_LANGUAGE)===0;
try{var n=new XMLHttpRequest();
n.open("GET",a.externalize(d(l)),false);
n.send();
b[l]=JSON.parse(n.responseText)
}catch(m){}if(!b[l]){b[l]={}
}}return b[l]
};
k.get=function(p,m,n){var q;
var o;
var l;
q=k.getDictionary();
l=i?k.PSEUDO_PATTERN_KEY:n?p+" (("+n+"))":p;
if(q){o=q[l]
}if(!o){o=p
}if(i){o=o.replace("{string}",p).replace("{comment}",n?n:"")
}return h(o,m)
};
k.getVar=function(m,l){if(!m){return null
}return k.get(m,null,l)
};
k.getLanguages=function(){if(!f){try{var l=a.externalize("/libs/wcm/core/resources/languages.overlay.infinity.json");
var o=new XMLHttpRequest();
o.open("GET",l,false);
o.send();
var m=JSON.parse(o.responseText);
Object.keys(m).forEach(function(q){var p=m[q];
if(p.language){p.title=k.getVar(p.language)
}if(p.title&&p.country&&p.country!=="*"){p.title+=" ("+k.getVar(p.country)+")"
}});
f=m
}catch(n){f={}
}}return f
};
k.parseLocale=function(o){if(!o){return null
}var n=o.indexOf("_");
if(n<0){n=o.indexOf("-")
}var m;
var l;
if(n<0){m=o;
l=null
}else{m=o.substring(0,n);
l=o.substring(n+1)
}return{code:o,language:m,country:l}
};
return k
}())
}));
(function(a){if(typeof module==="object"&&module.exports){module.exports=a(require("jquery"))
}else{var b=window.Granite=window.Granite||{};
b.TouchIndicator=a(window.jQuery)
}}(function(d){var b={visibility:"hidden",position:"absolute",width:"30px",height:"30px","-webkit-border-radius":"20px","border-radius":"20px",border:"5px solid orange","-webkit-user-select":"none","user-select":"none",opacity:"0.5","z-index":"2000","pointer-events":"none"};
var c={};
var a=[];
return{debugWithMouse:false,init:function(){var e=this;
var f=".touchindicator";
d(document).on("touchstart"+f+"touchmove"+f+"touchend"+f,function(h){var g=h.originalEvent.touches;
e.update(g);
return true
});
if(this.debugWithMouse){d(document).on("mousemove"+f,function(g){g.identifer="fake";
e.update([g]);
return true
})
}},update:function(h){var f={};
for(var g=0;
g<h.length;
g++){var k=h[g];
var j=k.identifier;
var e=c[j];
if(!e){e=a.pop();
if(!e){e=d(document.createElement("div")).css(b);
d("body").append(e)
}}f[j]=e;
e.offset({left:k.pageX-20,top:k.pageY-20});
e.css("visibility","visible")
}for(j in c){if(c.hasOwnProperty(j)&&!f[j]){e=c[j];
e.css("visibility","hidden");
a.push(e)
}}c=f
}}
}));
(function(a){if(typeof module==="object"&&module.exports){module.exports=a()
}else{var b=window.Granite=window.Granite||{};
b.OptOutUtil=a()
}}(function(b){function a(c){if(String.prototype.trim){return c.trim()
}return c.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,"")
}return(function(){var c={};
var d=[];
var e=[];
c.init=function(f){if(f){d=f.cookieNames||[];
e=f.whitelistCookieNames||[]
}else{d=[];
e=[]
}};
c.getCookieNames=function(){return d
};
c.getWhitelistCookieNames=function(){return e
};
c.isOptedOut=function(){var h=document.cookie.split(";");
for(var g=0;
g<h.length;
g++){var f=h[g];
var j=a(f.split("=")[0]);
if(c.getCookieNames().indexOf(j)>=0){return true
}}return false
};
c.maySetCookie=function(f){return !(c.isOptedOut()&&c.getWhitelistCookieNames().indexOf(f)===-1)
};
return c
}())
}));
Granite.OptOutUtil.init(window.GraniteOptOutConfig);
Granite.HTTP.detectContextPath();
window._g=window._g||{};
_g.shared={};
if(window.console===undefined){window.console={log:function(a){}}
}_g.shared.HTTP=new function(){var createResponse=function(){var response=new Object();
response.headers=new Object();
response.body=new Object();
return response
};
var getResponseFromXhr=function(request){if(!request){return null
}var response=createResponse();
response.body=request.responseText;
response.headers[_g.HTTP.HEADER_STATUS]=request.status;
response.responseText=request.responseText;
response.status=request.status;
return response
};
return{EXTENSION_HTML:".html",EXTENSION_JSON:".json",EXTENSION_RES:".res",HEADER_STATUS:"Status",HEADER_MESSAGE:"Message",HEADER_LOCATION:"Location",HEADER_PATH:"Path",PARAM_NO_CACHE:"cq_ck",get:function(url,callback,scope,suppressForbiddenCheck){url=_g.HTTP.getXhrHookedURL(_g.HTTP.externalize(url,true));
if(callback!=undefined){return _g.$.ajax({type:"GET",url:url,externalize:false,encodePath:false,hook:false,complete:function(request,textStatus){var response=getResponseFromXhr(request);
if(!suppressForbiddenCheck){_g.HTTP.handleForbidden(response)
}callback.call(scope||this,this,textStatus=="success",response)
}})
}else{try{var request=_g.$.ajax({type:"GET",url:url,async:false,externalize:false,encodePath:false,hook:false});
var response=getResponseFromXhr(request);
if(!suppressForbiddenCheck){_g.HTTP.handleForbidden(response)
}return response
}catch(e){return null
}}},post:function(url,callback,params,scope,suppressErrorMsg,suppressForbiddenCheck){url=_g.HTTP.externalize(url,true);
var hook=_g.HTTP.getXhrHook(url,"POST",params);
if(hook){url=hook.url;
params=hook.params
}if(callback!=undefined){return _g.$.ajax({type:"POST",url:url,data:params,externalize:false,encodePath:false,hook:false,complete:function(request,textStatus){var response=_g.HTTP.buildPostResponseFromHTML(request.responseText);
if(!suppressForbiddenCheck){_g.HTTP.handleForbidden(request)
}callback.call(scope||this,this,textStatus=="success",response)
}})
}else{try{var request=_g.$.ajax({type:"POST",url:url,data:params,async:false,externalize:false,encodePath:false,hook:false});
var response=_g.HTTP.buildPostResponseFromHTML(request.responseText);
if(!suppressForbiddenCheck){_g.HTTP.handleForbidden(request)
}return response
}catch(e){return null
}}},getParameter:function(url,name){var params=_g.HTTP.getParameters(url,name);
return params!=null?params[0]:null
},getParameters:function(url,name){var values=[];
if(!name){return null
}name=encodeURIComponent(name);
if(url.indexOf("?")==-1){return null
}if(url.indexOf("#")!=-1){url=url.substring(0,url.indexOf("#"))
}var query=url.substring(url.indexOf("?")+1);
if(query.indexOf(name)==-1){return null
}var queryPts=query.split("&");
for(var i=0;
i<queryPts.length;
i++){var paramPts=queryPts[i].split("=");
if(paramPts[0]==name){values.push(paramPts.length>1?decodeURIComponent(paramPts[1]):"")
}}return values.length>0?values:null
},addParameter:function(url,name,value){if(value&&value instanceof Array){for(var i=0;
i<value.length;
i++){url=_g.HTTP.addParameter(url,name,value[i])
}return url
}var separator=url.indexOf("?")==-1?"?":"&";
var hashIdx=url.indexOf("#");
if(hashIdx<0){return url+separator+encodeURIComponent(name)+"="+encodeURIComponent(value)
}else{var hash=url.substring(hashIdx);
url=url.substring(0,hashIdx);
return url+separator+encodeURIComponent(name)+"="+encodeURIComponent(value)+hash
}},setParameter:function(url,name,value){url=_g.HTTP.removeParameter(url,name);
return _g.HTTP.addParameter(url,name,value)
},removeParameter:function(url,name){var pattern0="?"+encodeURIComponent(name)+"=";
var pattern1="&"+encodeURIComponent(name)+"=";
var pattern;
if(url.indexOf(pattern0)!=-1){pattern=pattern0
}else{if(url.indexOf(pattern1)!=-1){pattern=pattern1
}else{return url
}}var indexCutStart=url.indexOf(pattern);
var begin=url.substring(0,indexCutStart);
var indexCutEnd=url.indexOf("&",indexCutStart+1);
var end="";
if(indexCutEnd!=-1){end=url.substring(indexCutEnd);
if(end.indexOf("&")==0){end=end.replace("&","?")
}}return begin+end
},removeParameters:Granite.HTTP.removeParameters,addSelector:function(url,selector,index){if(!index){index=0
}var post="";
var pIndex=url.indexOf("?");
if(pIndex==-1){pIndex=url.indexOf("#")
}if(pIndex!=-1){post=url.substring(pIndex);
url=url.substring(0,pIndex)
}var sIndex=url.lastIndexOf("/");
var main=url.substring(sIndex);
if(main.indexOf("."+selector+".")==-1){var path=url.substring(0,sIndex);
var obj=main.split(".");
var newMain="";
var delim="";
if(index>obj.length-2||index==-1){index=obj.length-2
}for(var i=0;
i<obj.length;
i++){newMain+=delim+obj[i];
delim=".";
if(index==i){newMain+=delim+selector
}}return path+newMain+post
}else{return url
}},setSelector:function(url,selector,index){var post="";
var pIndex=url.indexOf("?");
if(pIndex==-1){pIndex=url.indexOf("#")
}if(pIndex!=-1){post=url.substring(pIndex);
url=url.substring(0,pIndex)
}var selectors=_g.HTTP.getSelectors(url);
var ext=url.substring(url.lastIndexOf("."));
url=url.substring(0,url.lastIndexOf("."));
var fragment=(selectors.length>0)?url.replace("."+selectors.join("."),""):url;
if(selectors.length>0){for(var i=0;
i<selectors.length;
i++){if(index==i){fragment+="."+selector
}else{fragment+="."+selectors[i]
}}}else{fragment+="."+selector
}return fragment+ext+post
},addSelectors:function(url,selectors){var res=url;
if(url&&selectors&&selectors.length){for(var i=0;
i<selectors.length;
i++){res=_g.HTTP.addSelector(res,selectors[i],i)
}}return res
},getAnchor:function(url){if(url.indexOf("#")!=-1){return url.substring(url.indexOf("#")+1)
}return""
},setAnchor:function(url,anchor){return _g.HTTP.removeAnchor(url)+"#"+anchor
},removeAnchor:Granite.HTTP.removeAnchor,noCaching:function(url){return _g.HTTP.setParameter(url,_g.HTTP.PARAM_NO_CACHE,new Date().valueOf())
},buildPostResponseFromNode:function(node,response){if(!node){return null
}if(response==undefined){response=createResponse()
}for(var i=0;
i<node.childNodes.length;
i++){var child=node.childNodes[i];
if(child.tagName){if(child.id){if(child.href){response.headers[child.id]=child.href
}else{response.headers[child.id]=child.innerHTML
}}response=_g.HTTP.buildPostResponseFromNode(child,response)
}}return response
},buildPostResponseFromHTML:function(html){var response=createResponse();
try{if(html.responseText!=undefined){html=html.responseText
}else{if(typeof html!="string"){html=html.toString()
}}var div=document.createElement("div");
div.innerHTML=html;
response=_g.HTTP.buildPostResponseFromNode(div,response);
div=null
}catch(e){}return response
},getCookie:function(name){var cname=encodeURIComponent(name)+"=";
var dc=document.cookie;
if(dc.length>0){var begin=dc.indexOf(cname);
if(begin!=-1){begin+=cname.length;
var end=dc.indexOf(";",begin);
if(end==-1){end=dc.length
}return decodeURIComponent(dc.substring(begin,end))
}}return null
},setCookie:function(name,value,path,days,domain,secure){if(typeof(days)!="number"){days=7
}var date;
if(days>0){date=new Date();
date.setTime(date.getTime()+(days*24*60*60*1000))
}else{date=new Date(0)
}document.cookie=encodeURIComponent(name)+"="+encodeURIComponent(value)+"; "+(days!=0?"expires="+date.toGMTString()+"; ":"")+(domain?"domain="+domain+"; ":"")+(path?"path="+path:"")+(secure?"; secure":"");
return value
},clearCookie:function(name,path,domain,secure){_g.HTTP.setCookie(name,"null",path||"",-1,domain||"",secure||"")
},getSchemeAndAuthority:Granite.HTTP.getSchemeAndAuthority,getContextPath:Granite.HTTP.getContextPath,externalize:function(url,encode){if((typeof G_IS_HOOKED!="undefined")&&G_IS_HOOKED(url)){return url
}if(encode){url=_g.HTTP.encodePathOfURI(url)
}url=Granite.HTTP.externalize(url);
return url
},internalize:Granite.HTTP.internalize,getPath:Granite.HTTP.getPath,getSuffix:function(){if(window.CQURLInfo&&CQURLInfo.suffix){return CQURLInfo.suffix
}return null
},getSelectors:function(url){if(!url&&window.CQURLInfo){if(CQURLInfo.selectors){return CQURLInfo.selectors
}}var selectors=[];
url=url||window.location.href;
url=_g.HTTP.removeParameters(url);
url=_g.HTTP.removeAnchor(url);
var fragment=url.substring(url.lastIndexOf("/"));
if(fragment){var split=fragment.split(".");
if(split.length>2){for(var i=0;
i<split.length;
i++){if(i>0&&i<split.length-1){selectors.push(split[i])
}}}}return selectors
},getExtension:function(url){if(!url&&window.CQURLInfo){if(CQURLInfo.extension){return CQURLInfo.extension
}}url=url||window.location.href;
url=_g.HTTP.removeParameters(url);
url=_g.HTTP.removeAnchor(url);
var pos=url.lastIndexOf(".");
if(pos<0){return""
}url=url.substring(pos+1);
pos=url.indexOf("/");
if(pos<0){return url
}return url.substring(0,pos)
},encodePathOfURI:Granite.HTTP.encodePathOfURI,encodePath:Granite.HTTP.encodePath,eval:Granite.HTTP.eval,isOkStatus:function(status){try{return(new String(status).indexOf("2")==0)
}catch(e){return false
}},isOk:function(response){try{return _g.HTTP.isOkStatus(response.headers[_g.HTTP.HEADER_STATUS])
}catch(e){return false
}},handleForbidden:function(response,suppressLogin){try{if(response[_g.HTTP.HEADER_STATUS.toLowerCase()]==403){Granite.HTTP.handleLoginRedirect();
return true
}return false
}catch(e){return false
}},getXhrHook:Granite.HTTP.getXhrHook,getXhrHookedURL:function(url,method,params){var hook=_g.HTTP.getXhrHook(url,method,params);
if(hook){return hook.url
}return url
},reloadHook:function(url){if(typeof G_RELOAD_HOOK!="undefined"&&_g.$.isFunction(G_RELOAD_HOOK)){if(CQURLInfo.selectorString!=""){url=_g.HTTP.addSelector(url,CQURLInfo.selectorString)
}url=G_RELOAD_HOOK(url)||url
}return url
}}
};
_g.HTTP=_g.shared.HTTP;
_g.shared.Util=new function(){return{reload:function(win,url,preventHistory){if(!win){win=window
}if(!url){url=_g.HTTP.noCaching(win.location.href)
}url=_g.HTTP.reloadHook(url);
if(preventHistory){win.location.replace(url)
}else{win.location.href=url
}},load:function(url,preventHistory){_g.Util.reload(window,url,preventHistory)
},open:function(url,win,name,options){if(!win){win=window
}if(!url){return
}url=_g.HTTP.reloadHook(url);
if(!name){name=""
}if(!options){options=""
}return win.open(url,name,options)
},htmlEncode:function(value){return !value?value:String(value).replace(/&/g,"&amp;").replace(/>/g,"&gt;").replace(/</g,"&lt;").replace(/"/g,"&quot;")
},htmlDecode:function(value){return !value?value:String(value).replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&quot;/g,'"').replace(/&amp;/g,"&")
},ellipsis:function(value,length,word){if(value&&value.length>length){if(word){var vs=value.substr(0,length-2);
var index=Math.max(vs.lastIndexOf(" "),vs.lastIndexOf("."),vs.lastIndexOf("!"),vs.lastIndexOf("?"),vs.lastIndexOf(";"));
if(index==-1||index<(length-15)){return value.substr(0,length-3)+"..."
}else{return vs.substr(0,index)+"..."
}}else{return value.substr(0,length-3)+"..."
}}return value
},patchText:Granite.Util.patchText,eval:function(response){return _g.HTTP.eval(response)
},getTopWindow:Granite.Util.getTopWindow,setIFrameMode:Granite.Util.setIFrameMode}
};
_g.Util=_g.shared.Util;
_g.shared.Sling=function(){return{SELECTOR_INFINITY:Granite.Sling.SELECTOR_INFINITY,CHARSET:Granite.Sling.CHARSET,STATUS:Granite.Sling.STATUS,STATUS_BROWSER:Granite.Sling.STATUS_BROWSER,OPERATION:Granite.Sling.OPERATION,OPERATION_DELETE:Granite.Sling.OPERATION_DELETE,OPERATION_MOVE:Granite.Sling.OPERATION_MOVE,DELETE_SUFFIX:Granite.Sling.DELETE_SUFFIX,TYPEHINT_SUFFIX:Granite.Sling.TYPEHINT_SUFFIX,COPY_SUFFIX:Granite.Sling.COPY_SUFFIX,MOVE_SUFFIX:Granite.Sling.MOVE_SUFFIX,ORDER:Granite.Sling.ORDER,REPLACE:Granite.Sling.REPLACE,DESTINATION:Granite.Sling.DESTINATION,SAVE_PARAM_PREFIX:Granite.Sling.SAVE_PARAM_PREFIX,IGNORE_PARAM:Granite.Sling.IGNORE_PARAM,REQUEST_LOGIN_PARAM:Granite.Sling.REQUEST_LOGIN_PARAM,LOGIN_URL:Granite.Sling.LOGIN_URL,LOGOUT_URL:Granite.Sling.LOGOUT_URL,processBinaryData:function(a){if(a&&a[":jcr:data"]!=undefined){var b=new Object();
b.size=a[":jcr:data"];
b.type=a["jcr:mimeType"];
b.date=a["jcr:lastModified"];
a=b
}return a
},getContentPath:function(c,a,b){var d=a;
if(d.lastIndexOf(".")>d.lastIndexOf("/")){d=d.substr(0,d.indexOf(".",d.lastIndexOf("/")))
}if(c){if(c.indexOf("/")==0){d=c
}else{if(b){while(c.indexOf("../")==0){c=c.substring(3);
d=d.substring(0,d.lastIndexOf("/"))
}}c=c.replace("./","");
d=d+"/"+c
}}return d
}}
}();
_g.Sling=_g.shared.Sling;
_g.shared.XSS=new function(){return{getXSSPropertyName:function(a){if(!a){return""
}if(_g.XSS.KEY_REGEXP.test(a)){return a
}return a+=_g.XSS.KEY_SUFFIX
},getXSSRecordPropertyValue:function(e,c,a){var d="";
if(e&&c){var b=e.get(this.getXSSPropertyName(c));
if(b){d=b
}else{d=this.getXSSValue(e.get(c))
}if(a&&!isNaN(a)){d=_g.Util.ellipsis(d,a,true)
}}return d
},getXSSTablePropertyValue:function(d,c,a){var e="";
if(d&&c){var b=d[this.getXSSPropertyName(c)];
if(b){e=b
}else{e=this.getXSSValue(d[c])
}if(a&&!isNaN(a)){e=_g.Util.ellipsis(e,a,true)
}}return e
},getXSSValue:function(a){if(a){return _g.Util.htmlEncode(a)
}else{return""
}},updatePropertyName:function(a,b){if(!a||!b||!a[b]){return
}if(a.xssProtect&&!a.xssKeepPropName){a[b]=this.getXSSPropertyName(a[b])
}},xssPropertyRenderer:function(d,b,c,a){if(a&&a.dataIndex&&c&&c.data&&c.data[this.getXSSPropertyName(a.dataIndex)]){d=c.data[this.getXSSPropertyName(a.dataIndex)];
if(a.ellipsisLimit&&!isNaN(a.ellipsisLimit)){d=_g.Util.ellipsis(d,a.ellipsisLimit,true)
}return d
}else{if(d){return d
}else{return""
}}}}
};
_g.XSS=_g.shared.XSS;
_g.XSS.KEY_SUFFIX="_xss";
_g.XSS.KEY_REGEXP=new RegExp(_g.XSS.KEY_SUFFIX+"$");
_g.shared.I18n=Granite.I18n;
_g.I18n=_g.shared.I18n;
_g.shared.I18n.getMessage=Granite.I18n.get;
_g.shared.I18n.getVarMessage=Granite.I18n.getVar;
_g.shared.String=new function(){return{startsWith:function(d,b){if(d==null||b==null){return d==null&&b==null
}if(b.length>d.length){return false
}var a=d.toString();
var c=b.toString();
return(a.indexOf(c)==0)
},endsWith:function(b,a){if(b==null||a==null){return b==null&&a==null
}if(a.length>b.length){return false
}b=b.toString();
a=a.toString();
return(b.lastIndexOf(a)==(b.length-a.length))
},contains:function(b,a){if(b==null||a==null){return false
}b=b.toString();
a=a.toString();
return(b.indexOf(a)>=0)
}}
};
_g.String=_g.shared.String;
_g.shared.ClientSidePersistence=function(a){var e={PERSISTENCE_NAME:_g.shared.ClientSidePersistence.decoratePersistenceName("ClientSidePersistence"),config:{},cache:null,getMode:function(){return this.config.mode
},getWindow:function(){return this.config.window||_g.shared.Util.getTopWindow()
},debug:function(){if(console){var f=this.getMap();
var h="[ClientSidePersistence -> mode="+this.getMode().name+", container="+(this.config.container||"")+"]\n";
var g=0;
var i=new RegExp("^"+this.config.container+"/");
for(var k=0,n=Object.keys(f).sort(),l=null;
k<n.length;
k++){var m=n[k];
if(this.config.container&&(typeof(m)=="string")&&!m.match(i)){continue
}var j=f[m];
h+="-["+ ++g+"]-> '"+m.replace(i,"")+"' = '"+decodeURIComponent(j)+"'\n"
}if(!g){h+="(container is empty)"
}console.log(h)
}},keyName:function(f){return(this.config.container?(this.config.container+"/"):"")+f
},getKeys:function(){var i=this.getMap();
var h=[];
if(i){for(var f in i){if(this.config.container){if(f.indexOf(this.config.container+"/")==0){var g=f.substring(this.config.container.length+1);
h.push(g)
}}else{h.push(f)
}}}return h
},get:function(f){var g=this.getMap()[this.keyName(f)];
return g?decodeURIComponent(g):g
},set:function(g,j){g=(typeof g==="string")?g.replace(/:=/g,""):"";
var i={key:g};
g=this.keyName(g);
if(!g.length){return
}var f=[];
var k=this.getMap();
i.action=k[g]?"update":"set";
if(j){k[g]=encodeURIComponent(j)
}else{i.action="remove";
delete k[g]
}for(var h in k){f.push(h+":="+k[h])
}this.cache=k;
this.write(f.join("|"));
_g.$.extend(i,{value:j,mode:this.getMode().name,container:this.config.container});
_g.$(_g.shared.ClientSidePersistence).trigger(_g.shared.ClientSidePersistence.EVENT_NAME,i)
},getMap:function(){if(!this.cache||!this.config.useCache){var i=this.read().split("|");
var g={};
for(var f=0;
f<i.length;
f++){var j=i[f].split(":=");
var h=j[0];
if(h&&h.length){g[h]=j[1]||""
}}this.cache=g
}return this.cache
},remove:function(f){this.set(f)
},clearMap:function(){this.write()
},read:function(){return this.config.mode.read(this)||""
},write:function(f){this.config.mode.write(this,f||"")
}};
_g.$.extend(e.config,_g.shared.ClientSidePersistence.getDefaultConfig(),a);
if(e.config.useContainer===false){e.config.container=null
}var d;
var c="test-"+Math.random();
if(e.config.mode===_g.shared.ClientSidePersistence.MODE_SESSION){d=false;
try{window.sessionStorage.setItem(c,c);
window.sessionStorage.removeItem(c)
}catch(b){d=true
}if(d){e.config.mode=_g.shared.ClientSidePersistence.MODE_LOCAL
}}if(e.config.mode===_g.shared.ClientSidePersistence.MODE_LOCAL){d=false;
try{window.localStorage.setItem(c,c);
window.localStorage.removeItem(c)
}catch(b){d=true
}if(d){e.config.mode=_g.shared.ClientSidePersistence.MODE_WINDOW
}}return e
};
_g.shared.ClientSidePersistence.EVENT_NAME="ClientSidePersistence";
_g.shared.ClientSidePersistence.MODE_SESSION={name:"session",read:function(a){return a.getWindow().sessionStorage.getItem(a.PERSISTENCE_NAME)
},write:function(a,c){if(Granite.OptOutUtil.isOptedOut()){return
}try{a.getWindow().sessionStorage.setItem(a.PERSISTENCE_NAME,c)
}catch(b){return
}}};
_g.shared.ClientSidePersistence.MODE_LOCAL={name:"local",read:function(a){return a.getWindow().localStorage.getItem(a.PERSISTENCE_NAME)
},write:function(a,c){if(Granite.OptOutUtil.isOptedOut()){return
}try{a.getWindow().localStorage.setItem(a.PERSISTENCE_NAME,c)
}catch(b){return
}}};
_g.shared.ClientSidePersistence.decoratePersistenceName=function(a){return a
};
_g.shared.ClientSidePersistence.MODE_WINDOW={name:"window",read:function(a){return a.getWindow().name
},write:function(a,b){if(Granite.OptOutUtil.isOptedOut()){return
}a.getWindow().name=b
}};
_g.shared.ClientSidePersistence.MODE_COOKIE={COOKIE_NAME:_g.shared.ClientSidePersistence.decoratePersistenceName("SessionPersistence"),name:"cookie",read:function(a){return _g.shared.ClientSidePersistence.CookieHelper.read(this.COOKIE_NAME)
},write:function(a,b){if(Granite.OptOutUtil.isOptedOut()&&!Granite.OptOutUtil.maySetCookie(this.COOKIE_NAME)){return
}if(!b){_g.shared.ClientSidePersistence.CookieHelper.erase(this.COOKIE_NAME)
}else{_g.shared.ClientSidePersistence.CookieHelper.set(this.COOKIE_NAME,b,365)
}}};
_g.shared.ClientSidePersistence.getDefaultConfig=function(){return{window:_g.shared.Util.getTopWindow(),useCache:false,container:null,mode:_g.shared.ClientSidePersistence.MODE_LOCAL}
};
_g.shared.ClientSidePersistence.CookieHelper={set:function(c,d,e){var a="";
if(e){var b=new Date();
b.setTime(b.getTime()+(e*24*60*60*1000));
a="; expires="+b.toGMTString()
}if(d){d=encodeURIComponent(d)
}document.cookie=c+"="+d+a+"; path=/"
},read:function(b){var f=b+"=";
var a=document.cookie.split(";");
for(var d=0;
d<a.length;
d++){var g=a[d];
while(g.charAt(0)==" "){g=g.substring(1,g.length)
}if(g.indexOf(f)==0){var e=g.substring(f.length,g.length);
return e?decodeURIComponent(e):null
}}return null
},erase:function(a){_g.shared.ClientSidePersistence.CookieHelper.set(a,"",-1)
}};
_g.shared.ClientSidePersistence.clearAllMaps=function(){var a=[_g.shared.ClientSidePersistence.MODE_COOKIE,_g.shared.ClientSidePersistence.MODE_LOCAL,_g.shared.ClientSidePersistence.MODE_SESSION,_g.shared.ClientSidePersistence.MODE_WINDOW];
_g.$.each(a,function(d,c){var b=new _g.shared.ClientSidePersistence({mode:c});
b.clearMap()
})
};
_g.I18n.init();
window.CQ=window.CQ||{};
CQ.shared=_g.shared;
CQ.Sling=CQ.shared.Sling;
CQ.I18n=CQ.shared.I18n;
G_XHR_HOOK=typeof CQ_XHR_HOOK!="undefined"?CQ_XHR_HOOK:undefined;
G_RELOAD_HOOK=typeof CQ_RELOAD_HOOK!="undefined"?CQ_RELOAD_HOOK:undefined;
G_IS_HOOKED=typeof CQ_IS_HOOKED!="undefined"?CQ_IS_HOOKED:undefined;
G_CONTENT_PATH=typeof CQ_CONTENT_PATH!="undefined"?CQ_CONTENT_PATH:undefined;
CQ.shared.Form=function(){var e=function(){var j=parent.frames.ContentFrame,m=j!==undefined?j.contentDocument:document;
var k=new Object();
var l=m.getElementsByTagName("label");
for(var h=0;
h<l.length;
h++){var g=l[h].htmlFor;
if(g){k[g]=l[h]
}}return k
};
var f=function(h){var i="";
var g=function(k){if(k.nodeType==3){i+=k.nodeValue
}if(k.nodeName.toLowerCase()=="select"||k.nodeName.toLowerCase()=="input"||k.nodeName.toLowerCase()=="textarea"||k.nodeName.toLowerCase()=="button"){return
}for(var j=0;
k.childNodes&&j<k.childNodes.length;
j++){g(k.childNodes[j])
}};
g(h);
return i
};
var c=function(g){return g.replace(/-\d+$/,"")
};
var b=function(h,g){if(!g){g=e()
}if(g[h]){return f(g[h])
}return null
};
var a=function(i){var h;
var j=i.nodeName.toLowerCase();
var g=d(i,"type")?i.getAttribute("type"):undefined;
if(j=="input"){if(g=="radio"||g=="checkbox"){if(d(i,"checked")){h=i.getAttribute("value")
}}else{if(i.type=="text"){h=i.defaultValue
}else{h=i.value
}}}else{if(j=="textarea"){h=i.value
}else{if(j=="option"&&d(i,"selected")){h=i.getAttribute("value")
}}}return h
};
var d=function(h,g){if(h==null){return false
}return($CQ(h).attr(g)!=undefined)
};
return{searchArray:function(h,g,k){for(var j=0;
j<h.length;
j++){if(h[j][g]&&h[j][g]==k){return h[j]
}}return null
},getLabelForField:function(g,i){if(!i){i=e()
}var j=g.getAttribute("id");
if(j&&i[j]){return f(i[j])
}var h=g.parentNode;
while(h){if(h.nodeName.toLowerCase()=="label"){return f(h)
}h=h.parentNode
}return g.getAttribute("name")
},getFields:function(){var j=parent.frames.ContentFrame,l=j!==undefined?j.contentDocument:document,k=e();
var g=[];
var h=function(p,r,q){var o=p.getAttribute("name");
var s=p.nodeName.toLowerCase();
var u;
if(s=="input"||s=="textarea"){var n=d(p,"type")?p.getAttribute("type").toLowerCase():"text";
if(n=="button"||n=="submit"||n=="reset"){return
}u=CQ.shared.Form.searchArray(g,"value",o);
if(!u){g.push({text:CQ.shared.Form.getLabelForField(p,k),value:o,name:o,enumeration:undefined,local:r,selector:q,type:s,defaultValue:a(p),node:p});
u=g[g.length-1]
}if(n=="radio"||(u.local&&n=="checkbox")){if(!u.enumeration){var v=p.getAttribute("id");
if(v){var x=c(v);
var w=b(x,k);
u.text=(w?w:o)
}else{u.text=o
}u.enumeration=[]
}u.enumeration.push({text:CQ.shared.Form.getLabelForField(p,k),value:p.getAttribute("value"),defaultValue:a(p),node:p})
}}else{if(s=="select"){g.push({text:CQ.shared.Form.getLabelForField(p,k),value:o,name:o,enumeration:[],local:r,type:s,selector:q,defaultValue:undefined,node:p});
u=g[g.length-1];
var m=p.getElementsByTagName("option");
for(var t=0;
t<m.length;
t++){u.enumeration.push({text:m[t].innerHTML,value:m[t].getAttribute("value"),defaultValue:a(m[t]),node:m[t]})
}}}};
var i=function(p,o,m){if(p.nodeName.toLowerCase()=="div"&&$CQ(p).children(".form_row").length>0){o=true;
m=$CQ(p).attr("class").replace(/\s/g,".")
}if(p.getAttribute&&p.getAttribute("name")){h(p,o,m)
}for(var n=0;
p.childNodes&&n<p.childNodes.length;
n++){var q=p.childNodes[n];
if(q.nodeType==1){i(q,o,m)
}}};
i(l,false,undefined);
return g
}}
}();
CQ.shared.User=function(infoData){return{data:null,language:null,userPropsPath:null,getUserPropsUrl:function(){if(!this.userPropsPath){this.userPropsPath=CQ.shared.User.PROXY_URI
}return this.userPropsPath
},load:function(){var url=this.getUserPropsUrl();
url=CQ.shared.HTTP.noCaching(url);
var response=CQ.shared.HTTP.get(url);
if(CQ.shared.HTTP.isOk(response)){this.data=CQ.shared.Util.eval(response)
}},init:function(infoData,force){if(!this.initialized||force){if(infoData){this.data=infoData
}else{this.load()
}this.initialized=true
}return this.data
},lazyInit:function(){this.lazyLoad=function(){this.load();
this.initialized=true
}
},isInitialized:function(){return this.initialized
},getLanguage:function(){if(!this.isInitialized()&&this.lazyLoad){this.lazyLoad.call(this)
}this.language=this.data&&this.data.preferences&&this.data.preferences["language"]?this.data.preferences["language"]:"en";
return this.language
}}
}();
CQ.shared.User.PROXY_URI=CQ.shared.HTTP.externalize("/libs/cq/security/userinfo"+CQ.shared.HTTP.EXTENSION_JSON);
CQ.shared.User.lazyInit();
CQ.shared.I18n.init({locale:function(){return document.documentElement.lang||CQ.shared.User.getLanguage()
},urlPrefix:"/libs/cq/i18n/dict."});
(function(){var l;
var g=[],r=[];
var H=0;
var a=+new Date+"";
var b=75;
var j=40;
var E=(" \t\x0B\f\xA0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000");
var w=/\b__p \+= '';/g,R=/\b(__p \+=) '' \+/g,e=/(__e\(.*?\)|\b__t\)) \+\n'';/g;
var z=/\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
var C=/\w*$/;
var p=/^\s*function[ \n\r\t]+\w/;
var m=/<%=([\s\S]+?)%>/g;
var W=RegExp("^["+E+"]*0+(?=.$)");
var P=/($^)/;
var i=/\bthis\b/;
var T=/['\n\r\t\u2028\u2029\\]/g;
var x=["Array","Boolean","Date","Function","Math","Number","Object","RegExp","String","_","attachEvent","clearTimeout","isFinite","isNaN","parseInt","setTimeout"];
var Z=0;
var S="[object Arguments]",t="[object Array]",A="[object Boolean]",I="[object Date]",ab="[object Function]",F="[object Number]",c="[object Object]",J="[object RegExp]",G="[object String]";
var u={};
u[ab]=false;
u[S]=u[t]=u[A]=u[I]=u[F]=u[c]=u[J]=u[G]=true;
var M={leading:false,maxWait:0,trailing:false};
var k={configurable:false,enumerable:false,value:null,writable:false};
var D={"boolean":false,"function":true,object:true,number:false,string:false,"undefined":false};
var L={"\\":"\\","'":"'","\n":"n","\r":"r","\t":"t","\u2028":"u2028","\u2029":"u2029"};
var B=(D[typeof window]&&window)||this;
var U=D[typeof exports]&&exports&&!exports.nodeType&&exports;
var y=D[typeof module]&&module&&!module.nodeType&&module;
var O=y&&y.exports===U&&U;
var v=D[typeof global]&&global;
if(v&&(v.global===v||v.window===v)){B=v
}function h(ag,af,ad){var ac=(ad||0)-1,ae=ag?ag.length:0;
while(++ac<ae){if(ag[ac]===af){return ac
}}return -1
}function N(ac,af){var ae=typeof af;
ac=ac.cache;
if(ae=="boolean"||af==null){return ac[af]?0:-1
}if(ae!="number"&&ae!="string"){ae="object"
}var ad=ae=="number"?af:a+af;
ac=(ac=ac[ae])&&ac[ad];
return ae=="object"?(ac&&h(ac,af)>-1?0:-1):(ac?0:-1)
}function K(ag){var ad=this.cache,af=typeof ag;
if(af=="boolean"||ag==null){ad[ag]=true
}else{if(af!="number"&&af!="string"){af="object"
}var ae=af=="number"?ag:a+ag,ac=ad[af]||(ad[af]={});
if(af=="object"){(ac[ae]||(ac[ae]=[])).push(ag)
}else{ac[ae]=true
}}}function o(ac){return ac.charCodeAt(0)
}function V(af,ae){var ai=af.criteria,ak=ae.criteria,ag=-1,ah=ai.length;
while(++ag<ah){var aj=ai[ag],ad=ak[ag];
if(aj!==ad){if(aj>ad||typeof aj=="undefined"){return 1
}if(aj<ad||typeof ad=="undefined"){return -1
}}}return af.index-ae.index
}function Y(aj){var af=-1,ah=aj.length,ai=aj[0],ae=aj[(ah/2)|0],ag=aj[ah-1];
if(ai&&typeof ai=="object"&&ae&&typeof ae=="object"&&ag&&typeof ag=="object"){return false
}var ad=q();
ad["false"]=ad["null"]=ad["true"]=ad["undefined"]=false;
var ac=q();
ac.array=aj;
ac.cache=ad;
ac.push=K;
while(++af<ah){ac.push(aj[af])
}return ac
}function f(ac){return"\\"+L[ac]
}function d(){return g.pop()||[]
}function q(){return r.pop()||{array:null,cache:null,criteria:null,"false":false,index:0,"null":false,number:null,object:null,push:null,string:null,"true":false,"undefined":false,value:null}
}function Q(ac){ac.length=0;
if(g.length<j){g.push(ac)
}}function n(ad){var ac=ad.cache;
if(ac){n(ac)
}ad.array=ad.cache=ad.criteria=ad.object=ad.number=ad.string=ad.value=null;
if(r.length<j){r.push(ad)
}}function s(ah,ag,ad){ag||(ag=0);
if(typeof ad=="undefined"){ad=ah?ah.length:0
}var ae=-1,af=ad-ag||0,ac=Array(af<0?0:af);
while(++ae<af){ac[ae]=ah[ag+ae]
}return ac
}function X(ah){ah=ah?aa.defaults(B.Object(),ah,aa.pick(B,x)):B;
var aF=ah.Array,cd=ah.Boolean,ce=ah.Date,aY=ah.Function,b3=ah.Math,bd=ah.Number,c1=ah.Object,cF=ah.RegExp,co=ah.String,aG=ah.TypeError;
var b7=[];
var cJ=c1.prototype;
var cV=ah._;
var az=cJ.toString;
var b0=cF("^"+co(az).replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/toString| for [^\]]+/g,".*?")+"$");
var aV=b3.ceil,bR=ah.clearTimeout,cN=b3.floor,bB=aY.prototype.toString,ar=b4(ar=c1.getPrototypeOf)&&ar,aZ=cJ.hasOwnProperty,aw=b7.push,aW=ah.setTimeout,cm=b7.splice,cI=b7.unshift;
var cG=(function(){try{var dh={},df=b4(df=c1.defineProperty)&&df,at=df(dh,dh,dh)&&df
}catch(dg){}return at
}());
var av=b4(av=c1.create)&&av,be=b4(be=aF.isArray)&&be,aI=ah.isFinite,bD=ah.isNaN,ci=b4(ci=c1.keys)&&ci,cj=b3.max,am=b3.min,da=ah.parseInt,bJ=b3.random;
var cK={};
cK[t]=aF;
cK[A]=cd;
cK[I]=ce;
cK[ab]=aY;
cK[c]=c1;
cK[F]=bd;
cK[J]=cF;
cK[G]=co;
function aT(at){return(at&&typeof at=="object"&&!bC(at)&&aZ.call(at,"__wrapped__"))?at:new cP(at)
}function cP(df,at){this.__chain__=!!at;
this.__wrapped__=df
}cP.prototype=aT.prototype;
var aE=aT.support={};
aE.funcDecomp=!b4(ah.WinRTError)&&i.test(X);
aE.funcNames=typeof aY.name=="string";
aT.templateSettings={escape:/<%-([\s\S]+?)%>/g,evaluate:/<%([\s\S]+?)%>/g,interpolate:m,variable:"",imports:{_:aT}};
function ap(di){var dh=di[0],df=di[2],at=di[4];
function dg(){if(df){var dl=s(df);
aw.apply(dl,arguments)
}if(this instanceof dg){var dk=bZ(dh.prototype),dj=dh.apply(dk,dl||arguments);
return dd(dj)?dj:dk
}return dh.apply(at,dl||arguments)
}ad(dg,di);
return dg
}function bi(dn,dk,dp,di,dg){if(dp){var dq=dp(dn);
if(typeof dq!="undefined"){return dq
}}var dh=dd(dn);
if(dh){var dl=az.call(dn);
if(!u[dl]){return dn
}var dm=cK[dl];
switch(dl){case A:case I:return new dm(+dn);
case F:case G:return new dm(dn);
case J:dq=dm(dn.source,C.exec(dn));
dq.lastIndex=dn.lastIndex;
return dq
}}else{return dn
}var dj=bC(dn);
if(dk){var df=!di;
di||(di=d());
dg||(dg=d());
var at=di.length;
while(at--){if(di[at]==dn){return dg[at]
}}dq=dj?dm(dn.length):{}
}else{dq=dj?s(dn):br({},dn)
}if(dj){if(aZ.call(dn,"index")){dq.index=dn.index
}if(aZ.call(dn,"input")){dq.input=dn.input
}}if(!dk){return dq
}di.push(dn);
dg.push(dq);
(dj?bA:bN)(dn,function(dr,ds){dq[ds]=bi(dr,dk,dp,di,dg)
});
if(df){Q(di);
Q(dg)
}return dq
}function bZ(at,df){return dd(at)?av(at):{}
}if(!av){bZ=(function(){function at(){}return function(dg){if(dd(dg)){at.prototype=dg;
var df=new at;
at.prototype=null
}return df||ah.Object()
}
}())
}function ct(df,at,di){if(typeof df!="function"){return bj
}if(typeof at=="undefined"||!("prototype" in df)){return df
}var dh=df.__bindData__;
if(typeof dh=="undefined"){if(aE.funcNames){dh=!df.name
}dh=dh||!aE.funcDecomp;
if(!dh){var dg=bB.call(df);
if(!aE.funcNames){dh=!p.test(dg)
}if(!dh){dh=i.test(dg);
ad(df,dh)
}}}if(dh===false||(dh!==true&&dh[1]&1)){return df
}switch(di){case 1:return function(dj){return df.call(at,dj)
};
case 2:return function(dk,dj){return df.call(at,dk,dj)
};
case 3:return function(dk,dj,dl){return df.call(at,dk,dj,dl)
};
case 4:return function(dj,dl,dk,dm){return df.call(at,dj,dl,dk,dm)
}
}return bX(df,at)
}function bl(dh){var dj=dh[0],dg=dh[1],dl=dh[2],df=dh[3],dp=dh[4],at=dh[5];
var di=dg&1,dr=dg&2,dn=dg&4,dm=dg&8,dq=dj;
function dk(){var dt=di?dp:this;
if(dl){var du=s(dl);
aw.apply(du,arguments)
}if(df||dn){du||(du=s(arguments));
if(df){aw.apply(du,df)
}if(dn&&du.length<at){dg|=16&~32;
return bl([dj,(dm?dg:dg&~3),du,null,dp,at])
}}du||(du=arguments);
if(dr){dj=dt[dq]
}if(this instanceof dk){dt=bZ(dj.prototype);
var ds=dj.apply(dt,du);
return dd(ds)?ds:dt
}return dj.apply(dt,du)
}ad(dk,dh);
return dk
}function dc(dh,dl){var dg=-1,di=b5(),df=dh?dh.length:0,dj=df>=b&&di===h,dm=[];
if(dj){var at=Y(dl);
if(at){di=N;
dl=at
}else{dj=false
}}while(++dg<df){var dk=dh[dg];
if(di(dl,dk)<0){dm.push(dk)
}}if(dj){n(dl)
}return dm
}function bT(dh,dj,df,dk){var dg=(dk||0)-1,at=dh?dh.length:0,dp=[];
while(++dg<at){var dl=dh[dg];
if(dl&&typeof dl=="object"&&typeof dl.length=="number"&&(bC(dl)||a4(dl))){if(!dj){dl=bT(dl,dj,df)
}var dn=-1,di=dl.length,dm=dp.length;
dp.length+=di;
while(++dn<di){dp[dm++]=dl[dn]
}}else{if(!df){dp.push(dl)
}}}return dp
}function bb(dx,dw,dl,dt,dz,dy){if(dl){var dr=dl(dx,dw);
if(typeof dr!="undefined"){return !!dr
}}if(dx===dw){return dx!==0||(1/dx==1/dw)
}var dk=typeof dx,di=typeof dw;
if(dx===dx&&!(dx&&D[dk])&&!(dw&&D[di])){return false
}if(dx==null||dw==null){return dx===dw
}var df=az.call(dx),dp=az.call(dw);
if(df==S){df=c
}if(dp==S){dp=c
}if(df!=dp){return false
}switch(df){case A:case I:return +dx==+dw;
case F:return(dx!=+dx)?dw!=+dw:(dx==0?(1/dx==1/dw):dx==+dw);
case J:case G:return dx==co(dw)
}var dm=df==t;
if(!dm){var ds=aZ.call(dx,"__wrapped__"),at=aZ.call(dw,"__wrapped__");
if(ds||at){return bb(ds?dx.__wrapped__:dx,at?dw.__wrapped__:dw,dl,dt,dz,dy)
}if(df!=c){return false
}var dj=dx.constructor,dg=dw.constructor;
if(dj!=dg&&!(ax(dj)&&dj instanceof dj&&ax(dg)&&dg instanceof dg)&&("constructor" in dx&&"constructor" in dw)){return false
}}var dq=!dz;
dz||(dz=d());
dy||(dy=d());
var dh=dz.length;
while(dh--){if(dz[dh]==dx){return dy[dh]==dw
}}var du=0;
dr=true;
dz.push(dx);
dy.push(dw);
if(dm){dh=dx.length;
du=dw.length;
dr=du==dh;
if(dr||dt){while(du--){var dn=dh,dv=dw[du];
if(dt){while(dn--){if((dr=bb(dx[dn],dv,dl,dt,dz,dy))){break
}}}else{if(!(dr=bb(dx[du],dv,dl,dt,dz,dy))){break
}}}}}else{ai(dw,function(dC,dB,dA){if(aZ.call(dA,dB)){du++;
return(dr=aZ.call(dx,dB)&&bb(dx[dB],dC,dl,dt,dz,dy))
}});
if(dr&&!dt){ai(dx,function(dC,dB,dA){if(aZ.call(dA,dB)){return(dr=--du>-1)
}})
}}dz.pop();
dy.pop();
if(dq){Q(dz);
Q(dy)
}return dr
}function ag(df,dg,di,at,dh){(bC(dg)?bA:bN)(dg,function(dq,dl){var dp,dm,dk=dq,dn=df[dl];
if(dq&&((dm=bC(dq))||aN(dq))){var dr=at.length;
while(dr--){if((dp=at[dr]==dq)){dn=dh[dr];
break
}}if(!dp){var dj;
if(di){dk=di(dn,dq);
if((dj=typeof dk!="undefined")){dn=dk
}}if(!dj){dn=dm?(bC(dn)?dn:[]):(aN(dn)?dn:{})
}at.push(dq);
dh.push(dn);
if(!dj){ag(dn,dq,di,at,dh)
}}}else{if(di){dk=di(dn,dq);
if(typeof dk=="undefined"){dk=dq
}}if(typeof dk!="undefined"){dn=dk
}}df[dl]=dn
})
}function ao(df,at){return df+cN(bJ()*(at-df+1))
}function ae(dk,dh,dp){var dj=-1,dl=b5(),dg=dk?dk.length:0,dq=[];
var dm=!dh&&dg>=b&&dl===h,df=(dp||dm)?d():dq;
if(dm){var at=Y(df);
dl=N;
df=at
}while(++dj<dg){var dn=dk[dj],di=dp?dp(dn,dj,dk):dn;
if(dh?!dj||df[df.length-1]!==di:dl(df,di)<0){if(dp||dm){df.push(di)
}dq.push(dn)
}}if(dm){Q(df.array);
n(df)
}else{if(dp){Q(df)
}}return dq
}function bS(at){return function(dk,dl,dg){var df={};
dl=aT.createCallback(dl,dg,3);
var dh=-1,di=dk?dk.length:0;
if(typeof di=="number"){while(++dh<di){var dj=dk[dh];
at(df,dj,dl(dj,dh,dk),dk)
}}else{bN(dk,function(dn,dm,dp){at(df,dn,dl(dn,dm,dp),dp)
})
}return df
}
}function cL(dk,dh,dl,dg,dr,at){var dj=dh&1,ds=dh&2,dp=dh&4,dn=dh&8,df=dh&16,dm=dh&32;
if(!ds&&!ax(dk)){throw new aG
}if(df&&!dl.length){dh&=~16;
df=dl=false
}if(dm&&!dg.length){dh&=~32;
dm=dg=false
}var di=dk&&dk.__bindData__;
if(di&&di!==true){di=s(di);
if(di[2]){di[2]=s(di[2])
}if(di[3]){di[3]=s(di[3])
}if(dj&&!(di[1]&1)){di[4]=dr
}if(!dj&&di[1]&1){dh|=8
}if(dp&&!(di[1]&4)){di[5]=at
}if(df){aw.apply(di[2]||(di[2]=[]),dl)
}if(dm){cI.apply(di[3]||(di[3]=[]),dg)
}di[1]|=dh;
return cL.apply(null,di)
}var dq=(dh==1||dh===17)?ap:bl;
return dq([dk,dh,dl,dg,dr,at])
}function bn(at){return aS[at]
}function b5(){var at=(at=aT.indexOf)===c4?h:at;
return at
}function b4(at){return typeof at=="function"&&b0.test(at)
}var ad=!cG?af:function(at,df){k.value=df;
cG(at,"__bindData__",k)
};
function aK(dg){var df,at;
if(!(dg&&az.call(dg)==c)||(df=dg.constructor,ax(df)&&!(df instanceof df))){return false
}ai(dg,function(di,dh){at=dh
});
return typeof at=="undefined"||aZ.call(dg,at)
}function bo(at){return bU[at]
}function a4(at){return at&&typeof at=="object"&&typeof at.length=="number"&&az.call(at)==S||false
}var bC=be||function(at){return at&&typeof at=="object"&&typeof at.length=="number"&&az.call(at)==t||false
};
var bc=function(dg){var df,dh=dg,at=[];
if(!dh){return at
}if(!(D[typeof dg])){return at
}for(df in dh){if(aZ.call(dh,df)){at.push(df)
}}return at
};
var b9=!ci?bc:function(at){if(!dd(at)){return[]
}return ci(at)
};
var aS={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
var bU=b6(aS);
var ca=cF("("+b9(bU).join("|")+")","g"),cg=cF("["+b9(aS).join("")+"]","g");
var br=function(di,at,dl){var dk,dh=di,dr=dh;
if(!dh){return dr
}var dn=arguments,df=0,dj=typeof dl=="number"?2:dn.length;
if(dj>3&&typeof dn[dj-2]=="function"){var dq=ct(dn[--dj-1],dn[dj--],2)
}else{if(dj>2&&typeof dn[dj-1]=="function"){dq=dn[--dj]
}}while(++df<dj){dh=dn[df];
if(dh&&D[typeof dh]){var dm=-1,dp=D[typeof dh]&&b9(dh),dg=dp?dp.length:0;
while(++dm<dg){dk=dp[dm];
dr[dk]=dq?dq(dr[dk],dh[dk]):dh[dk]
}}}return dr
};
function cB(dg,df,dh,at){if(typeof df!="boolean"&&df!=null){at=dh;
dh=df;
df=false
}return bi(dg,df,typeof dh=="function"&&ct(dh,at,1))
}function c9(df,dg,at){return bi(df,true,typeof dg=="function"&&ct(dg,at,1))
}function aP(df,dg){var at=bZ(df);
return dg?br(at,dg):at
}var bs=function(di,at,dl){var dk,dh=di,dq=dh;
if(!dh){return dq
}var dn=arguments,df=0,dj=typeof dl=="number"?2:dn.length;
while(++df<dj){dh=dn[df];
if(dh&&D[typeof dh]){var dm=-1,dp=D[typeof dh]&&b9(dh),dg=dp?dp.length:0;
while(++dm<dg){dk=dp[dm];
if(typeof dq[dk]=="undefined"){dq[dk]=dh[dk]
}}}}return dq
};
function cr(dg,dh,df){var at;
dh=aT.createCallback(dh,df,3);
bN(dg,function(dk,dj,di){if(dh(dk,dj,di)){at=dj;
return false
}});
return at
}function bM(dg,dh,df){var at;
dh=aT.createCallback(dh,df,3);
c0(dg,function(dk,dj,di){if(dh(dk,dj,di)){at=dj;
return false
}});
return at
}var ai=function(di,dj,df){var dg,dh=di,at=dh;
if(!dh){return at
}if(!D[typeof dh]){return at
}dj=dj&&typeof df=="undefined"?dj:ct(dj,df,3);
for(dg in dh){if(dj(dh[dg],dg,di)===false){return at
}}return at
};
function cs(df,di,at){var dh=[];
ai(df,function(dk,dj){dh.push(dj,dk)
});
var dg=dh.length;
di=ct(di,at,3);
while(dg--){if(di(dh[dg--],dh[dg],df)===false){break
}}return df
}var bN=function(dg,dl,dj){var dh,df=dg,dm=df;
if(!df){return dm
}if(!D[typeof df]){return dm
}dl=dl&&typeof dj=="undefined"?dl:ct(dl,dj,3);
var di=-1,dk=D[typeof df]&&b9(df),at=dk?dk.length:0;
while(++di<at){dh=dk[di];
if(dl(df[dh],dh,dg)===false){return dm
}}return dm
};
function c0(df,dj,at){var dh=b9(df),di=dh.length;
dj=ct(dj,at,3);
while(di--){var dg=dh[di];
if(dj(df[dg],dg,df)===false){break
}}return df
}function cH(df){var at=[];
ai(df,function(dh,dg){if(ax(dh)){at.push(dg)
}});
return at.sort()
}function cX(at,df){return at?aZ.call(at,df):false
}function b6(dg){var df=-1,di=b9(dg),dj=di.length,at={};
while(++df<dj){var dh=di[df];
at[dg[dh]]=dh
}return at
}function bG(at){return at===true||at===false||at&&typeof at=="object"&&az.call(at)==A||false
}function a7(at){return at&&typeof at=="object"&&az.call(at)==I||false
}function b1(at){return at&&at.nodeType===1||false
}function cp(dh){var at=true;
if(!dh){return at
}var df=az.call(dh),dg=dh.length;
if((df==t||df==G||df==S)||(df==c&&typeof dg=="number"&&ax(dh.splice))){return !dg
}bN(dh,function(){return(at=false)
});
return at
}function b2(dg,at,dh,df){return bb(dg,at,typeof dh=="function"&&ct(dh,df,2))
}function aJ(at){return aI(at)&&!bD(parseFloat(at))
}function ax(at){return typeof at=="function"
}function dd(at){return !!(at&&D[typeof at])
}function bP(at){return bq(at)&&at!=+at
}function c3(at){return at===null
}function bq(at){return typeof at=="number"||at&&typeof at=="object"&&az.call(at)==F||false
}var aN=!ar?aK:function(dg){if(!(dg&&az.call(dg)==c)){return false
}var at=dg.valueOf,df=b4(at)&&(df=ar(at))&&ar(df);
return df?(dg==df||ar(dg)==df):aK(dg)
};
function cR(at){return at&&typeof at=="object"&&az.call(at)==J||false
}function cy(at){return typeof at=="string"||at&&typeof at=="object"&&az.call(at)==G||false
}function bW(at){return typeof at=="undefined"
}function bg(dg,dh,df){var at={};
dh=aT.createCallback(dh,df,3);
bN(dg,function(dk,dj,di){at[dj]=dh(dk,dj,di)
});
return at
}function bI(di){var dh=arguments,dj=2;
if(!dd(di)){return di
}if(typeof dh[2]!="number"){dj=dh.length
}if(dj>3&&typeof dh[dj-2]=="function"){var dl=ct(dh[--dj-1],dh[dj--],2)
}else{if(dj>2&&typeof dh[dj-1]=="function"){dl=dh[--dj]
}}var dg=s(arguments,1,dj),df=-1,at=d(),dk=d();
while(++df<dj){ag(di,dg[df],dl,at,dk)
}Q(at);
Q(dk);
return di
}function cu(dh,dl,df){var at={};
if(typeof dl!="function"){var dj=[];
ai(dh,function(dn,dm){dj.push(dm)
});
dj=dc(dj,bT(arguments,true,false,1));
var dg=-1,dk=dj.length;
while(++dg<dk){var di=dj[dg];
at[di]=dh[di]
}}else{dl=aT.createCallback(dl,df,3);
ai(dh,function(dp,dn,dm){if(!dl(dp,dn,dm)){at[dn]=dp
}})
}return at
}function by(dg){var df=-1,di=b9(dg),dj=di.length,at=aF(dj);
while(++df<dj){var dh=di[df];
at[df]=[dh,dg[dh]]
}return at
}function bK(dh,dl,df){var at={};
if(typeof dl!="function"){var dg=-1,dj=bT(arguments,true,false,1),dk=dd(dh)?dj.length:0;
while(++dg<dk){var di=dj[dg];
if(di in dh){at[di]=dh[di]
}}}else{dl=aT.createCallback(dl,df,3);
ai(dh,function(dp,dn,dm){if(dl(dp,dn,dm)){at[dn]=dp
}})
}return at
}function cW(dg,dk,df,at){var dj=bC(dg);
if(df==null){if(dj){df=[]
}else{var di=dg&&dg.constructor,dh=di&&di.prototype;
df=bZ(dh)
}}if(dk){dk=aT.createCallback(dk,at,4);
(dj?bA:bN)(dg,function(dn,dm,dl){return dk(df,dn,dm,dl)
})
}return df
}function bv(dg){var df=-1,dh=b9(dg),di=dh.length,at=aF(di);
while(++df<di){at[df]=dg[dh[df]]
}return at
}function cM(dj){var dg=arguments,df=-1,dh=bT(dg,true,false,1),di=(dg[2]&&dg[2][dg[1]]===dj)?1:dh.length,at=aF(di);
while(++df<di){at[df]=dj[dh[df]]
}return at
}function a3(dk,dj,dh){var df=-1,dg=b5(),di=dk?dk.length:0,at=false;
dh=(dh<0?cj(0,di+dh):dh)||0;
if(bC(dk)){at=dg(dk,dj,dh)>-1
}else{if(typeof di=="number"){at=(cy(dk)?dk.indexOf(dj,dh):dg(dk,dj,dh))>-1
}else{bN(dk,function(dl){if(++df>=dh){return !(at=dl===dj)
}})
}}return at
}var bH=bS(function(at,dg,df){(aZ.call(at,df)?at[df]++:at[df]=1)
});
function ay(di,dj,df){var at=true;
dj=aT.createCallback(dj,df,3);
var dg=-1,dh=di?di.length:0;
if(typeof dh=="number"){while(++dg<dh){if(!(at=!!dj(di[dg],dg,di))){break
}}}else{bN(di,function(dl,dk,dm){return(at=!!dj(dl,dk,dm))
})
}return at
}function bO(dj,dk,df){var at=[];
dk=aT.createCallback(dk,df,3);
var dg=-1,dh=dj?dj.length:0;
if(typeof dh=="number"){while(++dg<dh){var di=dj[dg];
if(dk(di,dg,dj)){at.push(di)
}}}else{bN(dj,function(dm,dl,dn){if(dk(dm,dl,dn)){at.push(dm)
}})
}return at
}function bF(dj,dk,df){dk=aT.createCallback(dk,df,3);
var dg=-1,dh=dj?dj.length:0;
if(typeof dh=="number"){while(++dg<dh){var di=dj[dg];
if(dk(di,dg,dj)){return di
}}}else{var at;
bN(dj,function(dm,dl,dn){if(dk(dm,dl,dn)){at=dm;
return false
}});
return at
}}function c7(dg,dh,df){var at;
dh=aT.createCallback(dh,df,3);
aq(dg,function(dj,di,dk){if(dh(dj,di,dk)){at=dj;
return false
}});
return at
}function bA(dh,di,at){var df=-1,dg=dh?dh.length:0;
di=di&&typeof at=="undefined"?di:ct(di,at,3);
if(typeof dg=="number"){while(++df<dg){if(di(dh[df],df,dh)===false){break
}}}else{bN(dh,di)
}return dh
}function aq(dh,di,at){var dg=dh?dh.length:0;
di=di&&typeof at=="undefined"?di:ct(di,at,3);
if(typeof dg=="number"){while(dg--){if(di(dh[dg],dg,dh)===false){break
}}}else{var df=b9(dh);
dg=df.length;
bN(dh,function(dk,dj,dl){dj=df?df[--dg]:--dg;
return di(dl[dj],dj,dl)
})
}return dh
}var bp=bS(function(at,dg,df){(aZ.call(at,df)?at[df]:at[df]=[]).push(dg)
});
var c5=bS(function(at,dg,df){at[df]=dg
});
function aH(dk,df){var dh=s(arguments,2),dg=-1,dj=typeof df=="function",di=dk?dk.length:0,at=aF(typeof di=="number"?di:0);
bA(dk,function(dl){at[++dg]=(dj?df:dl[df]).apply(dl,dh)
});
return at
}function bk(di,dj,df){var dg=-1,dh=di?di.length:0;
dj=aT.createCallback(dj,df,3);
if(typeof dh=="number"){var at=aF(dh);
while(++dg<dh){at[dg]=dj(di[dg],dg,di)
}}else{at=[];
bN(di,function(dl,dk,dm){at[++dg]=dj(dl,dk,dm)
})
}return at
}function bh(dk,dl,df){var di=-Infinity,at=di;
if(typeof dl!="function"&&df&&df[dl]===dk){dl=null
}if(dl==null&&bC(dk)){var dg=-1,dh=dk.length;
while(++dg<dh){var dj=dk[dg];
if(dj>at){at=dj
}}}else{dl=(dl==null&&cy(dk))?o:aT.createCallback(dl,df,3);
bA(dk,function(dn,dm,dq){var dp=dl(dn,dm,dq);
if(dp>di){di=dp;
at=dn
}})
}return at
}function cl(dk,dl,df){var di=Infinity,at=di;
if(typeof dl!="function"&&df&&df[dl]===dk){dl=null
}if(dl==null&&bC(dk)){var dg=-1,dh=dk.length;
while(++dg<dh){var dj=dk[dg];
if(dj<at){at=dj
}}}else{dl=(dl==null&&cy(dk))?o:aT.createCallback(dl,df,3);
bA(dk,function(dn,dm,dq){var dp=dl(dn,dm,dq);
if(dp<di){di=dp;
at=dn
}})
}return at
}var c8=bk;
function cn(dj,dk,df,at){if(!dj){return df
}var dh=arguments.length<3;
dk=aT.createCallback(dk,at,4);
var dg=-1,di=dj.length;
if(typeof di=="number"){if(dh){df=dj[++dg]
}while(++dg<di){df=dk(df,dj[dg],dg,dj)
}}else{bN(dj,function(dm,dl,dn){df=dh?(dh=false,dm):dk(df,dm,dl,dn)
})
}return df
}function cT(dh,di,df,at){var dg=arguments.length<3;
di=aT.createCallback(di,at,4);
aq(dh,function(dk,dj,dl){df=dg?(dg=false,dk):di(df,dk,dj,dl)
});
return df
}function aA(df,dg,at){dg=aT.createCallback(dg,at,3);
return bO(df,function(di,dh,dj){return !dg(di,dh,dj)
})
}function cS(dg,dh,df){if(dg&&typeof dg.length!="number"){dg=bv(dg)
}if(dh==null||df){return dg?dg[ao(0,dg.length-1)]:l
}var at=bw(dg);
at.length=am(cj(0,dh),at.length);
return at
}function bw(dh){var df=-1,dg=dh?dh.length:0,at=aF(typeof dg=="number"?dg:0);
bA(dh,function(dj){var di=ao(0,++df);
at[df]=at[di];
at[di]=dj
});
return at
}function a6(df){var at=df?df.length:0;
return typeof at=="number"?at:b9(df).length
}function a5(di,dj,df){var at;
dj=aT.createCallback(dj,df,3);
var dg=-1,dh=di?di.length:0;
if(typeof dh=="number"){while(++dg<dh){if((at=dj(di[dg],dg,di))){break
}}}else{bN(di,function(dl,dk,dm){return !(at=dj(dl,dk,dm))
})
}return !!at
}function a8(dk,dl,df){var dh=-1,dj=bC(dl),di=dk?dk.length:0,at=aF(typeof di=="number"?di:0);
if(!dj){dl=aT.createCallback(dl,df,3)
}bA(dk,function(dp,dn,dq){var dm=at[++dh]=q();
if(dj){dm.criteria=bk(dl,function(dr){return dp[dr]
})
}else{(dm.criteria=d())[0]=dl(dp,dn,dq)
}dm.index=dh;
dm.value=dp
});
di=at.length;
at.sort(V);
while(di--){var dg=at[di];
at[di]=dg.value;
if(!dj){Q(dg.criteria)
}n(dg)
}return at
}function aC(at){if(at&&typeof at.length=="number"){return s(at)
}return bv(at)
}var aj=bO;
function aO(di){var df=-1,dg=di?di.length:0,at=[];
while(++df<dg){var dh=di[df];
if(dh){at.push(dh)
}}return at
}function ac(at){return dc(at,bT(arguments,true,true,1))
}function c2(di,dh,at){var df=-1,dg=di?di.length:0;
dh=aT.createCallback(dh,at,3);
while(++df<dg){if(dh(di[df],df,di)){return df
}}return -1
}function aL(dh,dg,at){var df=dh?dh.length:0;
dg=aT.createCallback(dg,at,3);
while(df--){if(dg(dh[df],df,dh)){return df
}}return -1
}function bf(dj,di,at){var dh=0,dg=dj?dj.length:0;
if(typeof di!="number"&&di!=null){var df=-1;
di=aT.createCallback(di,at,3);
while(++df<dg&&di(dj[df],df,dj)){dh++
}}else{dh=di;
if(dh==null||at){return dj?dj[0]:l
}}return s(dj,0,am(cj(0,dh),dg))
}function cA(dh,at,dg,df){if(typeof at!="boolean"&&at!=null){df=dg;
dg=(typeof at!="function"&&df&&df[at]===dh)?null:at;
at=false
}if(dg!=null){dh=bk(dh,dg,df)
}return bT(dh,at)
}function c4(di,dh,df){if(typeof df=="number"){var dg=di?di.length:0;
df=(df<0?cj(0,dg+df):df||0)
}else{if(df){var at=a9(di,dh);
return di[at]===dh?at:-1
}}return h(di,dh,df)
}function c6(dj,di,at){var dh=0,dg=dj?dj.length:0;
if(typeof di!="number"&&di!=null){var df=dg;
di=aT.createCallback(di,at,3);
while(df--&&di(dj[df],df,dj)){dh++
}}else{dh=(di==null||at)?1:di||dh
}return s(dj,0,am(cj(0,dg-dh),dg))
}function cx(){var dn=[],dg=-1,dj=arguments.length,dm=d(),dp=b5(),di=dp===h,df=d();
while(++dg<dj){var dq=arguments[dg];
if(bC(dq)||a4(dq)){dn.push(dq);
dm.push(di&&dq.length>=b&&Y(dg?dn[dg]:df))
}}var dl=dn[0],dk=-1,dh=dl?dl.length:0,dr=[];
outer:while(++dk<dh){var at=dm[0];
dq=dl[dk];
if((at?N(at,dq):dp(df,dq))<0){dg=dj;
(at||df).push(dq);
while(--dg){at=dm[dg];
if((at?N(at,dq):dp(dn[dg],dq))<0){continue outer
}}dr.push(dq)
}}while(dj--){at=dm[dj];
if(at){n(at)
}}Q(dm);
Q(df);
return dr
}function bt(dj,di,at){var dh=0,dg=dj?dj.length:0;
if(typeof di!="number"&&di!=null){var df=dg;
di=aT.createCallback(di,at,3);
while(df--&&di(dj[df],df,dj)){dh++
}}else{dh=di;
if(dh==null||at){return dj?dj[dg-1]:l
}}return s(dj,cj(0,dg-dh))
}function de(dh,dg,df){var at=dh?dh.length:0;
if(typeof df=="number"){at=(df<0?cj(0,at+df):am(df,at-1))+1
}while(at--){if(dh[at]===dg){return at
}}return -1
}function cb(dk){var dg=arguments,at=0,di=dg.length,dh=dk?dk.length:0;
while(++at<di){var df=-1,dj=dg[at];
while(++df<dh){if(dk[df]===dj){cm.call(dk,df--,1);
dh--
}}}return dk
}function aX(dj,df,di){dj=+dj||0;
di=typeof di=="number"?di:(+di||1);
if(df==null){df=dj;
dj=0
}var dg=-1,dh=cj(0,aV((df-dj)/(di||1))),at=aF(dh);
while(++dg<dh){at[dg]=dj;
dj+=di
}return at
}function aM(dk,dj,df){var dg=-1,dh=dk?dk.length:0,at=[];
dj=aT.createCallback(dj,df,3);
while(++dg<dh){var di=dk[dg];
if(dj(di,dg,dk)){at.push(di);
cm.call(dk,dg--,1);
dh--
}}return at
}function b8(dj,di,at){if(typeof di!="number"&&di!=null){var dh=0,df=-1,dg=dj?dj.length:0;
di=aT.createCallback(di,at,3);
while(++df<dg&&di(dj[df],df,dj)){dh++
}}else{dh=(di==null||at)?1:cj(0,di)
}return s(dj,dh)
}function a9(dk,di,dj,df){var at=0,dh=dk?dk.length:at;
dj=dj?aT.createCallback(dj,df,1):bj;
di=dj(di);
while(at<dh){var dg=(at+dh)>>>1;
(dj(dk[dg])<di)?at=dg+1:dh=dg
}return at
}function au(){return ae(bT(arguments,true,true))
}function bQ(dh,dg,df,at){if(typeof dg!="boolean"&&dg!=null){at=df;
df=(typeof dg!="function"&&at&&at[dg]===dh)?null:dg;
dg=false
}if(df!=null){df=aT.createCallback(df,at,3)
}return ae(dh,dg,df)
}function cZ(at){return dc(at,s(arguments,1))
}function bY(){var df=-1,dg=arguments.length;
while(++df<dg){var dh=arguments[df];
if(bC(dh)||a4(dh)){var at=at?ae(dc(at,dh).concat(dc(dh,at))):dh
}}return at||[]
}function an(){var dh=arguments.length>1?arguments:arguments[0],df=-1,dg=dh?bh(c8(dh,"length")):0,at=aF(dg<0?0:dg);
while(++df<dg){at[df]=c8(dh,df)
}return at
}function cC(dj,df){var dg=-1,di=dj?dj.length:0,at={};
if(!df&&di&&!bC(dj[0])){df=[]
}while(++dg<di){var dh=dj[dg];
if(df){at[dh]=df[dg]
}else{if(dh){at[dh[0]]=dh[1]
}}}return at
}function aR(df,at){if(!ax(at)){throw new aG
}return function(){if(--df<1){return at.apply(this,arguments)
}}
}function bX(df,at){return arguments.length>2?cL(df,17,s(arguments,2),null,at):cL(df,1,null,null,at)
}function bu(dg){var at=arguments.length>1?bT(arguments,true,false,1):cH(dg),df=-1,di=at.length;
while(++df<di){var dh=at[df];
dg[dh]=cL(dg[dh],1,null,null,dg)
}return dg
}function cQ(at,df){return arguments.length>2?cL(df,19,s(arguments,2),null,at):cL(df,3,null,null,at)
}function cE(){var at=arguments,df=at.length;
while(df--){if(!ax(at[df])){throw new aG
}}return function(){var dg=arguments,dh=at.length;
while(dh--){dg=[at[dh].apply(this,dg)]
}return dg[0]
}
}function cO(at,df){df=typeof df=="number"?df:(+df||at.length);
return cL(at,4,null,null,null,df)
}function cD(dh,dm,dt){var dp,dk,du,at,dr,ds,dq,dl=0,dj=false,dn=true;
if(!ax(dh)){throw new aG
}dm=cj(0,dm)||0;
if(dt===true){var dg=true;
dn=false
}else{if(dd(dt)){dg=dt.leading;
dj="maxWait" in dt&&(cj(dm,dt.maxWait)||0);
dn="trailing" in dt?dt.trailing:dn
}}var di=function(){var dw=dm-(cf()-at);
if(dw<=0){if(dk){bR(dk)
}var dv=dq;
dk=ds=dq=l;
if(dv){dl=cf();
du=dh.apply(dr,dp);
if(!ds&&!dk){dp=dr=null
}}}else{ds=aW(di,dw)
}};
var df=function(){if(ds){bR(ds)
}dk=ds=dq=l;
if(dn||(dj!==dm)){dl=cf();
du=dh.apply(dr,dp);
if(!ds&&!dk){dp=dr=null
}}};
return function(){dp=arguments;
at=cf();
dr=this;
dq=dn&&(ds||!dg);
if(dj===false){var dv=dg&&!ds
}else{if(!dk&&!dg){dl=at
}var dx=dj-(at-dl),dw=dx<=0;
if(dw){if(dk){dk=bR(dk)
}dl=at;
du=dh.apply(dr,dp)
}else{if(!dk){dk=aW(df,dx)
}}}if(dw&&ds){ds=bR(ds)
}else{if(!ds&&dm!==dj){ds=aW(di,dm)
}}if(dv){dw=true;
du=dh.apply(dr,dp)
}if(dw&&!ds&&!dk){dp=dr=null
}return du
}
}function a0(df){if(!ax(df)){throw new aG
}var at=s(arguments,1);
return aW(function(){df.apply(l,at)
},1)
}function bL(df,dg){if(!ax(df)){throw new aG
}var at=s(arguments,2);
return aW(function(){df.apply(l,at)
},dg)
}function a2(df,dg){if(!ax(df)){throw new aG
}var at=function(){var dh=at.cache,di=dg?dg.apply(this,arguments):a+arguments[0];
return aZ.call(dh,di)?dh[di]:(dh[di]=df.apply(this,arguments))
};
at.cache={};
return at
}function cw(dg){var df,at;
if(!ax(dg)){throw new aG
}return function(){if(df){return at
}df=true;
at=dg.apply(this,arguments);
dg=null;
return at
}
}function cU(at){return cL(at,16,s(arguments,1))
}function cq(at){return cL(at,32,null,s(arguments,1))
}function ck(df,dg,at){var di=true,dh=true;
if(!ax(df)){throw new aG
}if(at===false){di=false
}else{if(dd(at)){di="leading" in at?at.leading:di;
dh="trailing" in at?at.trailing:dh
}}M.leading=di;
M.maxWait=dg;
M.trailing=dh;
return cD(df,dg,M)
}function bV(at,df){return cL(df,16,[at])
}function cv(at){return function(){return at
}
}function aD(dj,df,dk){var di=typeof dj;
if(dj==null||di=="function"){return ct(dj,df,dk)
}if(di!="object"){return a1(dj)
}var dh=b9(dj),dg=dh[0],at=dj[dg];
if(dh.length==1&&at===at&&!dd(at)){return function(dm){var dl=dm[dg];
return at===dl&&(at!==0||(1/at==1/dl))
}
}return function(dm){var dn=dh.length,dl=false;
while(dn--){if(!(dl=bb(dm[dh[dn]],dj[dh[dn]],null,true))){break
}}return dl
}
}function ba(at){return at==null?"":co(at).replace(cg,bn)
}function bj(at){return at
}function aB(df,dk,at){var dg=true,di=dk&&cH(dk);
if(!dk||(!at&&!di.length)){if(at==null){at=dk
}dh=cP;
dk=df;
df=aT;
di=cH(dk)
}if(at===false){dg=false
}else{if(dd(at)&&"chain" in at){dg=at.chain
}}var dh=df,dj=ax(dh);
bA(di,function(dl){var dm=df[dl]=dk[dl];
if(dj){dh.prototype[dl]=function(){var dp=this.__chain__,dr=this.__wrapped__,dq=[dr];
aw.apply(dq,arguments);
var dn=dm.apply(df,dq);
if(dg||dp){if(dr===dn&&dd(dn)){return this
}dn=new dh(dn);
dn.__chain__=dp
}return dn
}
}})
}function cY(){ah._=cV;
return this
}function af(){}var cf=b4(cf=ce.now)&&cf||function(){return new ce().getTime()
};
var db=da(E+"08")==8?da:function(df,at){return da(cy(df)?df.replace(W,""):df,at||0)
};
function a1(at){return function(df){return df[at]
}
}function cc(dg,at,dj){var di=dg==null,df=at==null;
if(dj==null){if(typeof dg=="boolean"&&df){dj=dg;
dg=1
}else{if(!df&&typeof at=="boolean"){dj=at;
df=true
}}}if(di&&df){at=1
}dg=+dg||0;
if(df){at=dg;
dg=0
}else{at=+at||0
}if(dj||dg%1||at%1){var dh=bJ();
return am(dg+(dh*(at-dg+parseFloat("1e-"+((dh+"").length-1)))),at)
}return ao(dg,at)
}function aQ(at,df){if(at){var dg=at[df];
return ax(dg)?at[df]():dg
}}function bE(ds,dl,dv){var di=aT.templateSettings;
ds=co(ds||"");
dv=bs({},dv,di);
var dg=bs({},dv.imports,di.imports),dm=b9(dg),dh=bv(dg);
var dr,dn=0,dq=dv.interpolate||P,df="__p += '";
var du=cF((dv.escape||P).source+"|"+dq.source+"|"+(dq===m?z:P).source+"|"+(dv.evaluate||P).source+"|$","g");
ds.replace(du,function(dw,dA,dy,dx,dz,dB){dy||(dy=dx);
df+=ds.slice(dn,dB).replace(T,f);
if(dA){df+="' +\n__e("+dA+") +\n'"
}if(dz){dr=true;
df+="';\n"+dz+";\n__p += '"
}if(dy){df+="' +\n((__t = ("+dy+")) == null ? '' : __t) +\n'"
}dn=dB+dw.length;
return dw
});
df+="';\n";
var dj=dv.variable,dk=dj;
if(!dk){dj="obj";
df="with ("+dj+") {\n"+df+"\n}\n"
}df=(dr?df.replace(w,""):df).replace(R,"$1").replace(e,"$1;");
df="function("+dj+") {\n"+(dk?"":dj+" || ("+dj+" = {});\n")+"var __t, __p = '', __e = _.escape"+(dr?", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n":";\n")+df+"return __p\n}";
var at="\n/*\n//# sourceURL="+(dv.sourceURL||"/lodash/template/source["+(Z++)+"]")+"\n*/";
try{var dt=aY(dm,"return "+df+at).apply(l,dh)
}catch(dp){dp.source=df;
throw dp
}if(dl){return dt(dl)
}dt.source=df;
return dt
}function ak(di,dh,df){di=(di=+di)>-1?di:0;
var dg=-1,at=aF(di);
dh=ct(dh,df,1);
while(++dg<di){at[dg]=dh(dg)
}return at
}function al(at){return at==null?"":co(at).replace(ca,bo)
}function ch(at){var df=++H;
return co(at==null?"":at)+df
}function bx(at){at=new cP(at);
at.__chain__=true;
return at
}function cz(at,df){df(at);
return at
}function bz(){this.__chain__=true;
return this
}function bm(){return co(this.__wrapped__)
}function aU(){return this.__wrapped__
}aT.after=aR;
aT.assign=br;
aT.at=cM;
aT.bind=bX;
aT.bindAll=bu;
aT.bindKey=cQ;
aT.chain=bx;
aT.compact=aO;
aT.compose=cE;
aT.constant=cv;
aT.countBy=bH;
aT.create=aP;
aT.createCallback=aD;
aT.curry=cO;
aT.debounce=cD;
aT.defaults=bs;
aT.defer=a0;
aT.delay=bL;
aT.difference=ac;
aT.filter=bO;
aT.flatten=cA;
aT.forEach=bA;
aT.forEachRight=aq;
aT.forIn=ai;
aT.forInRight=cs;
aT.forOwn=bN;
aT.forOwnRight=c0;
aT.functions=cH;
aT.groupBy=bp;
aT.indexBy=c5;
aT.initial=c6;
aT.intersection=cx;
aT.invert=b6;
aT.invoke=aH;
aT.keys=b9;
aT.map=bk;
aT.mapValues=bg;
aT.max=bh;
aT.memoize=a2;
aT.merge=bI;
aT.min=cl;
aT.omit=cu;
aT.once=cw;
aT.pairs=by;
aT.partial=cU;
aT.partialRight=cq;
aT.pick=bK;
aT.pluck=c8;
aT.property=a1;
aT.pull=cb;
aT.range=aX;
aT.reject=aA;
aT.remove=aM;
aT.rest=b8;
aT.shuffle=bw;
aT.sortBy=a8;
aT.tap=cz;
aT.throttle=ck;
aT.times=ak;
aT.toArray=aC;
aT.transform=cW;
aT.union=au;
aT.uniq=bQ;
aT.values=bv;
aT.where=aj;
aT.without=cZ;
aT.wrap=bV;
aT.xor=bY;
aT.zip=an;
aT.zipObject=cC;
aT.collect=bk;
aT.drop=b8;
aT.each=bA;
aT.eachRight=aq;
aT.extend=br;
aT.methods=cH;
aT.object=cC;
aT.select=bO;
aT.tail=b8;
aT.unique=bQ;
aT.unzip=an;
aB(aT);
aT.clone=cB;
aT.cloneDeep=c9;
aT.contains=a3;
aT.escape=ba;
aT.every=ay;
aT.find=bF;
aT.findIndex=c2;
aT.findKey=cr;
aT.findLast=c7;
aT.findLastIndex=aL;
aT.findLastKey=bM;
aT.has=cX;
aT.identity=bj;
aT.indexOf=c4;
aT.isArguments=a4;
aT.isArray=bC;
aT.isBoolean=bG;
aT.isDate=a7;
aT.isElement=b1;
aT.isEmpty=cp;
aT.isEqual=b2;
aT.isFinite=aJ;
aT.isFunction=ax;
aT.isNaN=bP;
aT.isNull=c3;
aT.isNumber=bq;
aT.isObject=dd;
aT.isPlainObject=aN;
aT.isRegExp=cR;
aT.isString=cy;
aT.isUndefined=bW;
aT.lastIndexOf=de;
aT.mixin=aB;
aT.noConflict=cY;
aT.noop=af;
aT.now=cf;
aT.parseInt=db;
aT.random=cc;
aT.reduce=cn;
aT.reduceRight=cT;
aT.result=aQ;
aT.runInContext=X;
aT.size=a6;
aT.some=a5;
aT.sortedIndex=a9;
aT.template=bE;
aT.unescape=al;
aT.uniqueId=ch;
aT.all=ay;
aT.any=a5;
aT.detect=bF;
aT.findWhere=bF;
aT.foldl=cn;
aT.foldr=cT;
aT.include=a3;
aT.inject=cn;
aB(function(){var at={};
bN(aT,function(dg,df){if(!aT.prototype[df]){at[df]=dg
}});
return at
}(),false);
aT.first=bf;
aT.last=bt;
aT.sample=cS;
aT.take=bf;
aT.head=bf;
bN(aT,function(dg,df){var at=df!=="sample";
if(!aT.prototype[df]){aT.prototype[df]=function(dk,dj){var di=this.__chain__,dh=dg(this.__wrapped__,dk,dj);
return !di&&(dk==null||(dj&&!(at&&typeof dk=="function")))?dh:new cP(dh,di)
}
}});
aT.VERSION="2.4.1";
aT.prototype.chain=bz;
aT.prototype.toString=bm;
aT.prototype.value=aU;
aT.prototype.valueOf=aU;
bA(["join","pop","shift"],function(at){var df=b7[at];
aT.prototype[at]=function(){var dh=this.__chain__,dg=df.apply(this.__wrapped__,arguments);
return dh?new cP(dg,dh):dg
}
});
bA(["push","reverse","sort","unshift"],function(at){var df=b7[at];
aT.prototype[at]=function(){df.apply(this.__wrapped__,arguments);
return this
}
});
bA(["concat","slice","splice"],function(at){var df=b7[at];
aT.prototype[at]=function(){return new cP(df.apply(this.__wrapped__,arguments),this.__chain__)
}
});
return aT
}var aa=X();
if(typeof define=="function"&&typeof define.amd=="object"&&define.amd){B._=aa;
define(function(){return aa
})
}else{if(U&&y){if(O){(y.exports=aa)._=aa
}else{U._=aa
}}else{B._=aa
}}}.call(this));