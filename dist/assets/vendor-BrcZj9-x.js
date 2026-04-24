import{r as S,j as lt}from"./react-core-CmGSpuP4.js";/**
 * react-router v7.14.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */var od="popstate";function ad(t){return typeof t=="object"&&t!=null&&"pathname"in t&&"search"in t&&"hash"in t&&"state"in t&&"key"in t}function qw(t={}){function e(r,s){var u;let i=(u=s.state)==null?void 0:u.masked,{pathname:o,search:c,hash:l}=i||r.location;return Sc("",{pathname:o,search:c,hash:l},s.state&&s.state.usr||null,s.state&&s.state.key||"default",i?{pathname:r.location.pathname,search:r.location.search,hash:r.location.hash}:void 0)}function n(r,s){return typeof s=="string"?s:Bs(s)}return Hw(e,n,null,t)}function me(t,e){if(t===!1||t===null||typeof t>"u")throw new Error(e)}function yt(t,e){if(!t){typeof console<"u"&&console.warn(e);try{throw new Error(e)}catch{}}}function Ww(){return Math.random().toString(36).substring(2,10)}function cd(t,e){return{usr:t.state,key:t.key,idx:e,masked:t.unstable_mask?{pathname:t.pathname,search:t.search,hash:t.hash}:void 0}}function Sc(t,e,n=null,r,s){return{pathname:typeof t=="string"?t:t.pathname,search:"",hash:"",...typeof e=="string"?Ur(e):e,state:n,key:e&&e.key||r||Ww(),unstable_mask:s}}function Bs({pathname:t="/",search:e="",hash:n=""}){return e&&e!=="?"&&(t+=e.charAt(0)==="?"?e:"?"+e),n&&n!=="#"&&(t+=n.charAt(0)==="#"?n:"#"+n),t}function Ur(t){let e={};if(t){let n=t.indexOf("#");n>=0&&(e.hash=t.substring(n),t=t.substring(0,n));let r=t.indexOf("?");r>=0&&(e.search=t.substring(r),t=t.substring(0,r)),t&&(e.pathname=t)}return e}function Hw(t,e,n,r={}){let{window:s=document.defaultView,v5Compat:i=!1}=r,o=s.history,c="POP",l=null,u=h();u==null&&(u=0,o.replaceState({...o.state,idx:u},""));function h(){return(o.state||{idx:null}).idx}function f(){c="POP";let I=h(),P=I==null?null:I-u;u=I,l&&l({action:c,location:R.location,delta:P})}function m(I,P){c="PUSH";let x=ad(I)?I:Sc(R.location,I,P);u=h()+1;let V=cd(x,u),L=R.createHref(x.unstable_mask||x);try{o.pushState(V,"",L)}catch(O){if(O instanceof DOMException&&O.name==="DataCloneError")throw O;s.location.assign(L)}i&&l&&l({action:c,location:R.location,delta:1})}function y(I,P){c="REPLACE";let x=ad(I)?I:Sc(R.location,I,P);u=h();let V=cd(x,u),L=R.createHref(x.unstable_mask||x);o.replaceState(V,"",L),i&&l&&l({action:c,location:R.location,delta:0})}function w(I){return Gw(I)}let R={get action(){return c},get location(){return t(s,o)},listen(I){if(l)throw new Error("A history only accepts one active listener");return s.addEventListener(od,f),l=I,()=>{s.removeEventListener(od,f),l=null}},createHref(I){return e(s,I)},createURL:w,encodeLocation(I){let P=w(I);return{pathname:P.pathname,search:P.search,hash:P.hash}},push:m,replace:y,go(I){return o.go(I)}};return R}function Gw(t,e=!1){let n="http://localhost";typeof window<"u"&&(n=window.location.origin!=="null"?window.location.origin:window.location.href),me(n,"No window.location.(origin|href) available to create URL");let r=typeof t=="string"?t:Bs(t);return r=r.replace(/ $/,"%20"),!e&&r.startsWith("//")&&(r=n+r),new URL(r,n)}function wm(t,e,n="/"){return Kw(t,e,n,!1)}function Kw(t,e,n,r){let s=typeof e=="string"?Ur(e):e,i=zt(s.pathname||"/",n);if(i==null)return null;let o=Tm(t);Yw(o);let c=null;for(let l=0;c==null&&l<o.length;++l){let u=oT(i);c=sT(o[l],u,r)}return c}function Tm(t,e=[],n=[],r="",s=!1){let i=(o,c,l=s,u)=>{let h={relativePath:u===void 0?o.path||"":u,caseSensitive:o.caseSensitive===!0,childrenIndex:c,route:o};if(h.relativePath.startsWith("/")){if(!h.relativePath.startsWith(r)&&l)return;me(h.relativePath.startsWith(r),`Absolute route path "${h.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`),h.relativePath=h.relativePath.slice(r.length)}let f=Rt([r,h.relativePath]),m=n.concat(h);o.children&&o.children.length>0&&(me(o.index!==!0,`Index routes must not have child routes. Please remove all child routes from route path "${f}".`),Tm(o.children,e,m,f,l)),!(o.path==null&&!o.index)&&e.push({path:f,score:nT(f,o.index),routesMeta:m})};return t.forEach((o,c)=>{var l;if(o.path===""||!((l=o.path)!=null&&l.includes("?")))i(o,c);else for(let u of Em(o.path))i(o,c,!0,u)}),e}function Em(t){let e=t.split("/");if(e.length===0)return[];let[n,...r]=e,s=n.endsWith("?"),i=n.replace(/\?$/,"");if(r.length===0)return s?[i,""]:[i];let o=Em(r.join("/")),c=[];return c.push(...o.map(l=>l===""?i:[i,l].join("/"))),s&&c.push(...o),c.map(l=>t.startsWith("/")&&l===""?"/":l)}function Yw(t){t.sort((e,n)=>e.score!==n.score?n.score-e.score:rT(e.routesMeta.map(r=>r.childrenIndex),n.routesMeta.map(r=>r.childrenIndex)))}var Qw=/^:[\w-]+$/,Xw=3,Jw=2,Zw=1,eT=10,tT=-2,ld=t=>t==="*";function nT(t,e){let n=t.split("/"),r=n.length;return n.some(ld)&&(r+=tT),e&&(r+=Jw),n.filter(s=>!ld(s)).reduce((s,i)=>s+(Qw.test(i)?Xw:i===""?Zw:eT),r)}function rT(t,e){return t.length===e.length&&t.slice(0,-1).every((r,s)=>r===e[s])?t[t.length-1]-e[e.length-1]:0}function sT(t,e,n=!1){let{routesMeta:r}=t,s={},i="/",o=[];for(let c=0;c<r.length;++c){let l=r[c],u=c===r.length-1,h=i==="/"?e:e.slice(i.length)||"/",f=yo({path:l.relativePath,caseSensitive:l.caseSensitive,end:u},h),m=l.route;if(!f&&u&&n&&!r[r.length-1].route.index&&(f=yo({path:l.relativePath,caseSensitive:l.caseSensitive,end:!1},h)),!f)return null;Object.assign(s,f.params),o.push({params:s,pathname:Rt([i,f.pathname]),pathnameBase:uT(Rt([i,f.pathnameBase])),route:m}),f.pathnameBase!=="/"&&(i=Rt([i,f.pathnameBase]))}return o}function yo(t,e){typeof t=="string"&&(t={path:t,caseSensitive:!1,end:!0});let[n,r]=iT(t.path,t.caseSensitive,t.end),s=e.match(n);if(!s)return null;let i=s[0],o=i.replace(/(.)\/+$/,"$1"),c=s.slice(1);return{params:r.reduce((u,{paramName:h,isOptional:f},m)=>{if(h==="*"){let w=c[m]||"";o=i.slice(0,i.length-w.length).replace(/(.)\/+$/,"$1")}const y=c[m];return f&&!y?u[h]=void 0:u[h]=(y||"").replace(/%2F/g,"/"),u},{}),pathname:i,pathnameBase:o,pattern:t}}function iT(t,e=!1,n=!0){yt(t==="*"||!t.endsWith("*")||t.endsWith("/*"),`Route path "${t}" will be treated as if it were "${t.replace(/\*$/,"/*")}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${t.replace(/\*$/,"/*")}".`);let r=[],s="^"+t.replace(/\/*\*?$/,"").replace(/^\/*/,"/").replace(/[\\.*+^${}|()[\]]/g,"\\$&").replace(/\/:([\w-]+)(\?)?/g,(o,c,l,u,h)=>{if(r.push({paramName:c,isOptional:l!=null}),l){let f=h.charAt(u+o.length);return f&&f!=="/"?"/([^\\/]*)":"(?:/([^\\/]*))?"}return"/([^\\/]+)"}).replace(/\/([\w-]+)\?(\/|$)/g,"(/$1)?$2");return t.endsWith("*")?(r.push({paramName:"*"}),s+=t==="*"||t==="/*"?"(.*)$":"(?:\\/(.+)|\\/*)$"):n?s+="\\/*$":t!==""&&t!=="/"&&(s+="(?:(?=\\/|$))"),[new RegExp(s,e?void 0:"i"),r]}function oT(t){try{return t.split("/").map(e=>decodeURIComponent(e).replace(/\//g,"%2F")).join("/")}catch(e){return yt(!1,`The URL path "${t}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${e}).`),t}}function zt(t,e){if(e==="/")return t;if(!t.toLowerCase().startsWith(e.toLowerCase()))return null;let n=e.endsWith("/")?e.length-1:e.length,r=t.charAt(n);return r&&r!=="/"?null:t.slice(n)||"/"}var aT=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;function cT(t,e="/"){let{pathname:n,search:r="",hash:s=""}=typeof t=="string"?Ur(t):t,i;return n?(n=n.replace(/\/\/+/g,"/"),n.startsWith("/")?i=ud(n.substring(1),"/"):i=ud(n,e)):i=e,{pathname:i,search:hT(r),hash:dT(s)}}function ud(t,e){let n=e.replace(/\/+$/,"").split("/");return t.split("/").forEach(s=>{s===".."?n.length>1&&n.pop():s!=="."&&n.push(s)}),n.length>1?n.join("/"):"/"}function Wa(t,e,n,r){return`Cannot include a '${t}' character in a manually specified \`to.${e}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`}function lT(t){return t.filter((e,n)=>n===0||e.route.path&&e.route.path.length>0)}function Sl(t){let e=lT(t);return e.map((n,r)=>r===e.length-1?n.pathname:n.pathnameBase)}function Ko(t,e,n,r=!1){let s;typeof t=="string"?s=Ur(t):(s={...t},me(!s.pathname||!s.pathname.includes("?"),Wa("?","pathname","search",s)),me(!s.pathname||!s.pathname.includes("#"),Wa("#","pathname","hash",s)),me(!s.search||!s.search.includes("#"),Wa("#","search","hash",s)));let i=t===""||s.pathname==="",o=i?"/":s.pathname,c;if(o==null)c=n;else{let f=e.length-1;if(!r&&o.startsWith("..")){let m=o.split("/");for(;m[0]==="..";)m.shift(),f-=1;s.pathname=m.join("/")}c=f>=0?e[f]:"/"}let l=cT(s,c),u=o&&o!=="/"&&o.endsWith("/"),h=(i||o===".")&&n.endsWith("/");return!l.pathname.endsWith("/")&&(u||h)&&(l.pathname+="/"),l}var Rt=t=>t.join("/").replace(/\/\/+/g,"/"),uT=t=>t.replace(/\/+$/,"").replace(/^\/*/,"/"),hT=t=>!t||t==="?"?"":t.startsWith("?")?t:"?"+t,dT=t=>!t||t==="#"?"":t.startsWith("#")?t:"#"+t,fT=class{constructor(t,e,n,r=!1){this.status=t,this.statusText=e||"",this.internal=r,n instanceof Error?(this.data=n.toString(),this.error=n):this.data=n}};function pT(t){return t!=null&&typeof t.status=="number"&&typeof t.statusText=="string"&&typeof t.internal=="boolean"&&"data"in t}function mT(t){return t.map(e=>e.route.path).filter(Boolean).join("/").replace(/\/\/*/g,"/")||"/"}var Im=typeof window<"u"&&typeof window.document<"u"&&typeof window.document.createElement<"u";function bm(t,e){let n=t;if(typeof n!="string"||!aT.test(n))return{absoluteURL:void 0,isExternal:!1,to:n};let r=n,s=!1;if(Im)try{let i=new URL(window.location.href),o=n.startsWith("//")?new URL(i.protocol+n):new URL(n),c=zt(o.pathname,e);o.origin===i.origin&&c!=null?n=c+o.search+o.hash:s=!0}catch{yt(!1,`<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`)}return{absoluteURL:r,isExternal:s,to:n}}Object.getOwnPropertyNames(Object.prototype).sort().join("\0");var Am=["POST","PUT","PATCH","DELETE"];new Set(Am);var gT=["GET",...Am];new Set(gT);var Br=S.createContext(null);Br.displayName="DataRouter";var Yo=S.createContext(null);Yo.displayName="DataRouterState";var Rm=S.createContext(!1);function yT(){return S.useContext(Rm)}var Sm=S.createContext({isTransitioning:!1});Sm.displayName="ViewTransition";var _T=S.createContext(new Map);_T.displayName="Fetchers";var vT=S.createContext(null);vT.displayName="Await";var it=S.createContext(null);it.displayName="Navigation";var ni=S.createContext(null);ni.displayName="Location";var Nt=S.createContext({outlet:null,matches:[],isDataRoute:!1});Nt.displayName="Route";var Pl=S.createContext(null);Pl.displayName="RouteError";var Pm="REACT_ROUTER_ERROR",wT="REDIRECT",TT="ROUTE_ERROR_RESPONSE";function ET(t){if(t.startsWith(`${Pm}:${wT}:{`))try{let e=JSON.parse(t.slice(28));if(typeof e=="object"&&e&&typeof e.status=="number"&&typeof e.statusText=="string"&&typeof e.location=="string"&&typeof e.reloadDocument=="boolean"&&typeof e.replace=="boolean")return e}catch{}}function IT(t){if(t.startsWith(`${Pm}:${TT}:{`))try{let e=JSON.parse(t.slice(40));if(typeof e=="object"&&e&&typeof e.status=="number"&&typeof e.statusText=="string")return new fT(e.status,e.statusText,e.data)}catch{}}function bT(t,{relative:e}={}){me(jr(),"useHref() may be used only in the context of a <Router> component.");let{basename:n,navigator:r}=S.useContext(it),{hash:s,pathname:i,search:o}=ri(t,{relative:e}),c=i;return n!=="/"&&(c=i==="/"?n:Rt([n,i])),r.createHref({pathname:c,search:o,hash:s})}function jr(){return S.useContext(ni)!=null}function Lt(){return me(jr(),"useLocation() may be used only in the context of a <Router> component."),S.useContext(ni).location}var Cm="You should call navigate() in a React.useEffect(), not when your component is first rendered.";function km(t){S.useContext(it).static||S.useLayoutEffect(t)}function xm(){let{isDataRoute:t}=S.useContext(Nt);return t?OT():AT()}function AT(){me(jr(),"useNavigate() may be used only in the context of a <Router> component.");let t=S.useContext(Br),{basename:e,navigator:n}=S.useContext(it),{matches:r}=S.useContext(Nt),{pathname:s}=Lt(),i=JSON.stringify(Sl(r)),o=S.useRef(!1);return km(()=>{o.current=!0}),S.useCallback((l,u={})=>{if(yt(o.current,Cm),!o.current)return;if(typeof l=="number"){n.go(l);return}let h=Ko(l,JSON.parse(i),s,u.relative==="path");t==null&&e!=="/"&&(h.pathname=h.pathname==="/"?e:Rt([e,h.pathname])),(u.replace?n.replace:n.push)(h,u.state,u)},[e,n,i,s,t])}S.createContext(null);function ri(t,{relative:e}={}){let{matches:n}=S.useContext(Nt),{pathname:r}=Lt(),s=JSON.stringify(Sl(n));return S.useMemo(()=>Ko(t,JSON.parse(s),r,e==="path"),[t,s,r,e])}function RT(t,e){return Vm(t,e)}function Vm(t,e,n){var I;me(jr(),"useRoutes() may be used only in the context of a <Router> component.");let{navigator:r}=S.useContext(it),{matches:s}=S.useContext(Nt),i=s[s.length-1],o=i?i.params:{},c=i?i.pathname:"/",l=i?i.pathnameBase:"/",u=i&&i.route;{let P=u&&u.path||"";Mm(c,!u||P.endsWith("*")||P.endsWith("*?"),`You rendered descendant <Routes> (or called \`useRoutes()\`) at "${c}" (under <Route path="${P}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${P}"> to <Route path="${P==="/"?"*":`${P}/*`}">.`)}let h=Lt(),f;if(e){let P=typeof e=="string"?Ur(e):e;me(l==="/"||((I=P.pathname)==null?void 0:I.startsWith(l)),`When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${l}" but pathname "${P.pathname}" was given in the \`location\` prop.`),f=P}else f=h;let m=f.pathname||"/",y=m;if(l!=="/"){let P=l.replace(/^\//,"").split("/");y="/"+m.replace(/^\//,"").split("/").slice(P.length).join("/")}let w=wm(t,{pathname:y});yt(u||w!=null,`No routes matched location "${f.pathname}${f.search}${f.hash}" `),yt(w==null||w[w.length-1].route.element!==void 0||w[w.length-1].route.Component!==void 0||w[w.length-1].route.lazy!==void 0,`Matched leaf route at location "${f.pathname}${f.search}${f.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);let R=xT(w&&w.map(P=>Object.assign({},P,{params:Object.assign({},o,P.params),pathname:Rt([l,r.encodeLocation?r.encodeLocation(P.pathname.replace(/%/g,"%25").replace(/\?/g,"%3F").replace(/#/g,"%23")).pathname:P.pathname]),pathnameBase:P.pathnameBase==="/"?l:Rt([l,r.encodeLocation?r.encodeLocation(P.pathnameBase.replace(/%/g,"%25").replace(/\?/g,"%3F").replace(/#/g,"%23")).pathname:P.pathnameBase])})),s,n);return e&&R?S.createElement(ni.Provider,{value:{location:{pathname:"/",search:"",hash:"",state:null,key:"default",unstable_mask:void 0,...f},navigationType:"POP"}},R):R}function ST(){let t=LT(),e=pT(t)?`${t.status} ${t.statusText}`:t instanceof Error?t.message:JSON.stringify(t),n=t instanceof Error?t.stack:null,r="rgba(200,200,200, 0.5)",s={padding:"0.5rem",backgroundColor:r},i={padding:"2px 4px",backgroundColor:r},o=null;return console.error("Error handled by React Router default ErrorBoundary:",t),o=S.createElement(S.Fragment,null,S.createElement("p",null,"💿 Hey developer 👋"),S.createElement("p",null,"You can provide a way better UX than this when your app throws errors by providing your own ",S.createElement("code",{style:i},"ErrorBoundary")," or"," ",S.createElement("code",{style:i},"errorElement")," prop on your route.")),S.createElement(S.Fragment,null,S.createElement("h2",null,"Unexpected Application Error!"),S.createElement("h3",{style:{fontStyle:"italic"}},e),n?S.createElement("pre",{style:s},n):null,o)}var PT=S.createElement(ST,null),Dm=class extends S.Component{constructor(t){super(t),this.state={location:t.location,revalidation:t.revalidation,error:t.error}}static getDerivedStateFromError(t){return{error:t}}static getDerivedStateFromProps(t,e){return e.location!==t.location||e.revalidation!=="idle"&&t.revalidation==="idle"?{error:t.error,location:t.location,revalidation:t.revalidation}:{error:t.error!==void 0?t.error:e.error,location:e.location,revalidation:t.revalidation||e.revalidation}}componentDidCatch(t,e){this.props.onError?this.props.onError(t,e):console.error("React Router caught the following error during render",t)}render(){let t=this.state.error;if(this.context&&typeof t=="object"&&t&&"digest"in t&&typeof t.digest=="string"){const n=IT(t.digest);n&&(t=n)}let e=t!==void 0?S.createElement(Nt.Provider,{value:this.props.routeContext},S.createElement(Pl.Provider,{value:t,children:this.props.component})):this.props.children;return this.context?S.createElement(CT,{error:t},e):e}};Dm.contextType=Rm;var Ha=new WeakMap;function CT({children:t,error:e}){let{basename:n}=S.useContext(it);if(typeof e=="object"&&e&&"digest"in e&&typeof e.digest=="string"){let r=ET(e.digest);if(r){let s=Ha.get(e);if(s)throw s;let i=bm(r.location,n);if(Im&&!Ha.get(e))if(i.isExternal||r.reloadDocument)window.location.href=i.absoluteURL||i.to;else{const o=Promise.resolve().then(()=>window.__reactRouterDataRouter.navigate(i.to,{replace:r.replace}));throw Ha.set(e,o),o}return S.createElement("meta",{httpEquiv:"refresh",content:`0;url=${i.absoluteURL||i.to}`})}}return t}function kT({routeContext:t,match:e,children:n}){let r=S.useContext(Br);return r&&r.static&&r.staticContext&&(e.route.errorElement||e.route.ErrorBoundary)&&(r.staticContext._deepestRenderedBoundaryId=e.route.id),S.createElement(Nt.Provider,{value:t},n)}function xT(t,e=[],n){let r=n==null?void 0:n.state;if(t==null){if(!r)return null;if(r.errors)t=r.matches;else if(e.length===0&&!r.initialized&&r.matches.length>0)t=r.matches;else return null}let s=t,i=r==null?void 0:r.errors;if(i!=null){let h=s.findIndex(f=>f.route.id&&(i==null?void 0:i[f.route.id])!==void 0);me(h>=0,`Could not find a matching route for errors on route IDs: ${Object.keys(i).join(",")}`),s=s.slice(0,Math.min(s.length,h+1))}let o=!1,c=-1;if(n&&r){o=r.renderFallback;for(let h=0;h<s.length;h++){let f=s[h];if((f.route.HydrateFallback||f.route.hydrateFallbackElement)&&(c=h),f.route.id){let{loaderData:m,errors:y}=r,w=f.route.loader&&!m.hasOwnProperty(f.route.id)&&(!y||y[f.route.id]===void 0);if(f.route.lazy||w){n.isStatic&&(o=!0),c>=0?s=s.slice(0,c+1):s=[s[0]];break}}}}let l=n==null?void 0:n.onError,u=r&&l?(h,f)=>{var m,y;l(h,{location:r.location,params:((y=(m=r.matches)==null?void 0:m[0])==null?void 0:y.params)??{},unstable_pattern:mT(r.matches),errorInfo:f})}:void 0;return s.reduceRight((h,f,m)=>{let y,w=!1,R=null,I=null;r&&(y=i&&f.route.id?i[f.route.id]:void 0,R=f.route.errorElement||PT,o&&(c<0&&m===0?(Mm("route-fallback",!1,"No `HydrateFallback` element provided to render during initial hydration"),w=!0,I=null):c===m&&(w=!0,I=f.route.hydrateFallbackElement||null)));let P=e.concat(s.slice(0,m+1)),x=()=>{let V;return y?V=R:w?V=I:f.route.Component?V=S.createElement(f.route.Component,null):f.route.element?V=f.route.element:V=h,S.createElement(kT,{match:f,routeContext:{outlet:h,matches:P,isDataRoute:r!=null},children:V})};return r&&(f.route.ErrorBoundary||f.route.errorElement||m===0)?S.createElement(Dm,{location:r.location,revalidation:r.revalidation,component:R,error:y,children:x(),routeContext:{outlet:null,matches:P,isDataRoute:!0},onError:u}):x()},null)}function Cl(t){return`${t} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function VT(t){let e=S.useContext(Br);return me(e,Cl(t)),e}function DT(t){let e=S.useContext(Yo);return me(e,Cl(t)),e}function MT(t){let e=S.useContext(Nt);return me(e,Cl(t)),e}function kl(t){let e=MT(t),n=e.matches[e.matches.length-1];return me(n.route.id,`${t} can only be used on routes that contain a unique "id"`),n.route.id}function NT(){return kl("useRouteId")}function LT(){var r;let t=S.useContext(Pl),e=DT("useRouteError"),n=kl("useRouteError");return t!==void 0?t:(r=e.errors)==null?void 0:r[n]}function OT(){let{router:t}=VT("useNavigate"),e=kl("useNavigate"),n=S.useRef(!1);return km(()=>{n.current=!0}),S.useCallback(async(s,i={})=>{yt(n.current,Cm),n.current&&(typeof s=="number"?await t.navigate(s):await t.navigate(s,{fromRouteId:e,...i}))},[t,e])}var hd={};function Mm(t,e,n){!e&&!hd[t]&&(hd[t]=!0,yt(!1,n))}S.memo(FT);function FT({routes:t,future:e,state:n,isStatic:r,onError:s}){return Vm(t,void 0,{state:n,isStatic:r,onError:s})}function H2({to:t,replace:e,state:n,relative:r}){me(jr(),"<Navigate> may be used only in the context of a <Router> component.");let{static:s}=S.useContext(it);yt(!s,"<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.");let{matches:i}=S.useContext(Nt),{pathname:o}=Lt(),c=xm(),l=Ko(t,Sl(i),o,r==="path"),u=JSON.stringify(l);return S.useEffect(()=>{c(JSON.parse(u),{replace:e,state:n,relative:r})},[c,u,r,e,n]),null}function UT(t){me(!1,"A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.")}function BT({basename:t="/",children:e=null,location:n,navigationType:r="POP",navigator:s,static:i=!1,unstable_useTransitions:o}){me(!jr(),"You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");let c=t.replace(/^\/*/,"/"),l=S.useMemo(()=>({basename:c,navigator:s,static:i,unstable_useTransitions:o,future:{}}),[c,s,i,o]);typeof n=="string"&&(n=Ur(n));let{pathname:u="/",search:h="",hash:f="",state:m=null,key:y="default",unstable_mask:w}=n,R=S.useMemo(()=>{let I=zt(u,c);return I==null?null:{location:{pathname:I,search:h,hash:f,state:m,key:y,unstable_mask:w},navigationType:r}},[c,u,h,f,m,y,r,w]);return yt(R!=null,`<Router basename="${c}"> is not able to match the URL "${u}${h}${f}" because it does not start with the basename, so the <Router> won't render anything.`),R==null?null:S.createElement(it.Provider,{value:l},S.createElement(ni.Provider,{children:e,value:R}))}function G2({children:t,location:e}){return RT(Pc(t),e)}function Pc(t,e=[]){let n=[];return S.Children.forEach(t,(r,s)=>{if(!S.isValidElement(r))return;let i=[...e,s];if(r.type===S.Fragment){n.push.apply(n,Pc(r.props.children,i));return}me(r.type===UT,`[${typeof r.type=="string"?r.type:r.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`),me(!r.props.index||!r.props.children,"An index route cannot have child routes.");let o={id:r.props.id||i.join("-"),caseSensitive:r.props.caseSensitive,element:r.props.element,Component:r.props.Component,index:r.props.index,path:r.props.path,middleware:r.props.middleware,loader:r.props.loader,action:r.props.action,hydrateFallbackElement:r.props.hydrateFallbackElement,HydrateFallback:r.props.HydrateFallback,errorElement:r.props.errorElement,ErrorBoundary:r.props.ErrorBoundary,hasErrorBoundary:r.props.hasErrorBoundary===!0||r.props.ErrorBoundary!=null||r.props.errorElement!=null,shouldRevalidate:r.props.shouldRevalidate,handle:r.props.handle,lazy:r.props.lazy};r.props.children&&(o.children=Pc(r.props.children,i)),n.push(o)}),n}var Qi="get",Xi="application/x-www-form-urlencoded";function Qo(t){return typeof HTMLElement<"u"&&t instanceof HTMLElement}function jT(t){return Qo(t)&&t.tagName.toLowerCase()==="button"}function $T(t){return Qo(t)&&t.tagName.toLowerCase()==="form"}function zT(t){return Qo(t)&&t.tagName.toLowerCase()==="input"}function qT(t){return!!(t.metaKey||t.altKey||t.ctrlKey||t.shiftKey)}function WT(t,e){return t.button===0&&(!e||e==="_self")&&!qT(t)}var Ni=null;function HT(){if(Ni===null)try{new FormData(document.createElement("form"),0),Ni=!1}catch{Ni=!0}return Ni}var GT=new Set(["application/x-www-form-urlencoded","multipart/form-data","text/plain"]);function Ga(t){return t!=null&&!GT.has(t)?(yt(!1,`"${t}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${Xi}"`),null):t}function KT(t,e){let n,r,s,i,o;if($T(t)){let c=t.getAttribute("action");r=c?zt(c,e):null,n=t.getAttribute("method")||Qi,s=Ga(t.getAttribute("enctype"))||Xi,i=new FormData(t)}else if(jT(t)||zT(t)&&(t.type==="submit"||t.type==="image")){let c=t.form;if(c==null)throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');let l=t.getAttribute("formaction")||c.getAttribute("action");if(r=l?zt(l,e):null,n=t.getAttribute("formmethod")||c.getAttribute("method")||Qi,s=Ga(t.getAttribute("formenctype"))||Ga(c.getAttribute("enctype"))||Xi,i=new FormData(c,t),!HT()){let{name:u,type:h,value:f}=t;if(h==="image"){let m=u?`${u}.`:"";i.append(`${m}x`,"0"),i.append(`${m}y`,"0")}else u&&i.append(u,f)}}else{if(Qo(t))throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');n=Qi,r=null,s=Xi,o=t}return i&&s==="text/plain"&&(o=i,i=void 0),{action:r,method:n.toLowerCase(),encType:s,formData:i,body:o}}Object.getOwnPropertyNames(Object.prototype).sort().join("\0");function xl(t,e){if(t===!1||t===null||typeof t>"u")throw new Error(e)}function Nm(t,e,n,r){let s=typeof t=="string"?new URL(t,typeof window>"u"?"server://singlefetch/":window.location.origin):t;return n?s.pathname.endsWith("/")?s.pathname=`${s.pathname}_.${r}`:s.pathname=`${s.pathname}.${r}`:s.pathname==="/"?s.pathname=`_root.${r}`:e&&zt(s.pathname,e)==="/"?s.pathname=`${e.replace(/\/$/,"")}/_root.${r}`:s.pathname=`${s.pathname.replace(/\/$/,"")}.${r}`,s}async function YT(t,e){if(t.id in e)return e[t.id];try{let n=await import(t.module);return e[t.id]=n,n}catch(n){return console.error(`Error loading route module \`${t.module}\`, reloading page...`),console.error(n),window.__reactRouterContext&&window.__reactRouterContext.isSpaMode,window.location.reload(),new Promise(()=>{})}}function QT(t){return t==null?!1:t.href==null?t.rel==="preload"&&typeof t.imageSrcSet=="string"&&typeof t.imageSizes=="string":typeof t.rel=="string"&&typeof t.href=="string"}async function XT(t,e,n){let r=await Promise.all(t.map(async s=>{let i=e.routes[s.route.id];if(i){let o=await YT(i,n);return o.links?o.links():[]}return[]}));return tE(r.flat(1).filter(QT).filter(s=>s.rel==="stylesheet"||s.rel==="preload").map(s=>s.rel==="stylesheet"?{...s,rel:"prefetch",as:"style"}:{...s,rel:"prefetch"}))}function dd(t,e,n,r,s,i){let o=(l,u)=>n[u]?l.route.id!==n[u].route.id:!0,c=(l,u)=>{var h;return n[u].pathname!==l.pathname||((h=n[u].route.path)==null?void 0:h.endsWith("*"))&&n[u].params["*"]!==l.params["*"]};return i==="assets"?e.filter((l,u)=>o(l,u)||c(l,u)):i==="data"?e.filter((l,u)=>{var f;let h=r.routes[l.route.id];if(!h||!h.hasLoader)return!1;if(o(l,u)||c(l,u))return!0;if(l.route.shouldRevalidate){let m=l.route.shouldRevalidate({currentUrl:new URL(s.pathname+s.search+s.hash,window.origin),currentParams:((f=n[0])==null?void 0:f.params)||{},nextUrl:new URL(t,window.origin),nextParams:l.params,defaultShouldRevalidate:!0});if(typeof m=="boolean")return m}return!0}):[]}function JT(t,e,{includeHydrateFallback:n}={}){return ZT(t.map(r=>{let s=e.routes[r.route.id];if(!s)return[];let i=[s.module];return s.clientActionModule&&(i=i.concat(s.clientActionModule)),s.clientLoaderModule&&(i=i.concat(s.clientLoaderModule)),n&&s.hydrateFallbackModule&&(i=i.concat(s.hydrateFallbackModule)),s.imports&&(i=i.concat(s.imports)),i}).flat(1))}function ZT(t){return[...new Set(t)]}function eE(t){let e={},n=Object.keys(t).sort();for(let r of n)e[r]=t[r];return e}function tE(t,e){let n=new Set;return new Set(e),t.reduce((r,s)=>{let i=JSON.stringify(eE(s));return n.has(i)||(n.add(i),r.push({key:i,link:s})),r},[])}function Vl(){let t=S.useContext(Br);return xl(t,"You must render this element inside a <DataRouterContext.Provider> element"),t}function nE(){let t=S.useContext(Yo);return xl(t,"You must render this element inside a <DataRouterStateContext.Provider> element"),t}var Dl=S.createContext(void 0);Dl.displayName="FrameworkContext";function Ml(){let t=S.useContext(Dl);return xl(t,"You must render this element inside a <HydratedRouter> element"),t}function rE(t,e){let n=S.useContext(Dl),[r,s]=S.useState(!1),[i,o]=S.useState(!1),{onFocus:c,onBlur:l,onMouseEnter:u,onMouseLeave:h,onTouchStart:f}=e,m=S.useRef(null);S.useEffect(()=>{if(t==="render"&&o(!0),t==="viewport"){let R=P=>{P.forEach(x=>{o(x.isIntersecting)})},I=new IntersectionObserver(R,{threshold:.5});return m.current&&I.observe(m.current),()=>{I.disconnect()}}},[t]),S.useEffect(()=>{if(r){let R=setTimeout(()=>{o(!0)},100);return()=>{clearTimeout(R)}}},[r]);let y=()=>{s(!0)},w=()=>{s(!1),o(!1)};return n?t!=="intent"?[i,m,{}]:[i,m,{onFocus:ys(c,y),onBlur:ys(l,w),onMouseEnter:ys(u,y),onMouseLeave:ys(h,w),onTouchStart:ys(f,y)}]:[!1,m,{}]}function ys(t,e){return n=>{t&&t(n),n.defaultPrevented||e(n)}}function sE({page:t,...e}){let n=yT(),{router:r}=Vl(),s=S.useMemo(()=>wm(r.routes,t,r.basename),[r.routes,t,r.basename]);return s?n?S.createElement(oE,{page:t,matches:s,...e}):S.createElement(aE,{page:t,matches:s,...e}):null}function iE(t){let{manifest:e,routeModules:n}=Ml(),[r,s]=S.useState([]);return S.useEffect(()=>{let i=!1;return XT(t,e,n).then(o=>{i||s(o)}),()=>{i=!0}},[t,e,n]),r}function oE({page:t,matches:e,...n}){let r=Lt(),{future:s}=Ml(),{basename:i}=Vl(),o=S.useMemo(()=>{if(t===r.pathname+r.search+r.hash)return[];let c=Nm(t,i,s.unstable_trailingSlashAwareDataRequests,"rsc"),l=!1,u=[];for(let h of e)typeof h.route.shouldRevalidate=="function"?l=!0:u.push(h.route.id);return l&&u.length>0&&c.searchParams.set("_routes",u.join(",")),[c.pathname+c.search]},[i,s.unstable_trailingSlashAwareDataRequests,t,r,e]);return S.createElement(S.Fragment,null,o.map(c=>S.createElement("link",{key:c,rel:"prefetch",as:"fetch",href:c,...n})))}function aE({page:t,matches:e,...n}){let r=Lt(),{future:s,manifest:i,routeModules:o}=Ml(),{basename:c}=Vl(),{loaderData:l,matches:u}=nE(),h=S.useMemo(()=>dd(t,e,u,i,r,"data"),[t,e,u,i,r]),f=S.useMemo(()=>dd(t,e,u,i,r,"assets"),[t,e,u,i,r]),m=S.useMemo(()=>{if(t===r.pathname+r.search+r.hash)return[];let R=new Set,I=!1;if(e.forEach(x=>{var L;let V=i.routes[x.route.id];!V||!V.hasLoader||(!h.some(O=>O.route.id===x.route.id)&&x.route.id in l&&((L=o[x.route.id])!=null&&L.shouldRevalidate)||V.hasClientLoader?I=!0:R.add(x.route.id))}),R.size===0)return[];let P=Nm(t,c,s.unstable_trailingSlashAwareDataRequests,"data");return I&&R.size>0&&P.searchParams.set("_routes",e.filter(x=>R.has(x.route.id)).map(x=>x.route.id).join(",")),[P.pathname+P.search]},[c,s.unstable_trailingSlashAwareDataRequests,l,r,i,h,e,t,o]),y=S.useMemo(()=>JT(f,i),[f,i]),w=iE(f);return S.createElement(S.Fragment,null,m.map(R=>S.createElement("link",{key:R,rel:"prefetch",as:"fetch",href:R,...n})),y.map(R=>S.createElement("link",{key:R,rel:"modulepreload",href:R,...n})),w.map(({key:R,link:I})=>S.createElement("link",{key:R,nonce:n.nonce,...I,crossOrigin:I.crossOrigin??n.crossOrigin})))}function cE(...t){return e=>{t.forEach(n=>{typeof n=="function"?n(e):n!=null&&(n.current=e)})}}var lE=typeof window<"u"&&typeof window.document<"u"&&typeof window.document.createElement<"u";try{lE&&(window.__reactRouterVersion="7.14.0")}catch{}function K2({basename:t,children:e,unstable_useTransitions:n,window:r}){let s=S.useRef();s.current==null&&(s.current=qw({window:r,v5Compat:!0}));let i=s.current,[o,c]=S.useState({action:i.action,location:i.location}),l=S.useCallback(u=>{n===!1?c(u):S.startTransition(()=>c(u))},[n]);return S.useLayoutEffect(()=>i.listen(l),[i,l]),S.createElement(BT,{basename:t,children:e,location:o.location,navigationType:o.action,navigator:i,unstable_useTransitions:n})}var Lm=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,Om=S.forwardRef(function({onClick:e,discover:n="render",prefetch:r="none",relative:s,reloadDocument:i,replace:o,unstable_mask:c,state:l,target:u,to:h,preventScrollReset:f,viewTransition:m,unstable_defaultShouldRevalidate:y,...w},R){let{basename:I,navigator:P,unstable_useTransitions:x}=S.useContext(it),V=typeof h=="string"&&Lm.test(h),L=bm(h,I);h=L.to;let O=bT(h,{relative:s}),z=Lt(),b=null;if(c){let se=Ko(c,[],z.unstable_mask?z.unstable_mask.pathname:"/",!0);I!=="/"&&(se.pathname=se.pathname==="/"?I:Rt([I,se.pathname])),b=P.createHref(se)}let[g,v,E]=rE(r,w),A=fE(h,{replace:o,unstable_mask:c,state:l,target:u,preventScrollReset:f,relative:s,viewTransition:m,unstable_defaultShouldRevalidate:y,unstable_useTransitions:x});function C(se){e&&e(se),se.defaultPrevented||A(se)}let T=!(L.isExternal||i),ie=S.createElement("a",{...w,...E,href:(T?b:void 0)||L.absoluteURL||O,onClick:T?C:e,ref:cE(R,v),target:u,"data-discover":!V&&n==="render"?"true":void 0});return g&&!V?S.createElement(S.Fragment,null,ie,S.createElement(sE,{page:O})):ie});Om.displayName="Link";var uE=S.forwardRef(function({"aria-current":e="page",caseSensitive:n=!1,className:r="",end:s=!1,style:i,to:o,viewTransition:c,children:l,...u},h){let f=ri(o,{relative:u.relative}),m=Lt(),y=S.useContext(Yo),{navigator:w,basename:R}=S.useContext(it),I=y!=null&&_E(f)&&c===!0,P=w.encodeLocation?w.encodeLocation(f).pathname:f.pathname,x=m.pathname,V=y&&y.navigation&&y.navigation.location?y.navigation.location.pathname:null;n||(x=x.toLowerCase(),V=V?V.toLowerCase():null,P=P.toLowerCase()),V&&R&&(V=zt(V,R)||V);const L=P!=="/"&&P.endsWith("/")?P.length-1:P.length;let O=x===P||!s&&x.startsWith(P)&&x.charAt(L)==="/",z=V!=null&&(V===P||!s&&V.startsWith(P)&&V.charAt(P.length)==="/"),b={isActive:O,isPending:z,isTransitioning:I},g=O?e:void 0,v;typeof r=="function"?v=r(b):v=[r,O?"active":null,z?"pending":null,I?"transitioning":null].filter(Boolean).join(" ");let E=typeof i=="function"?i(b):i;return S.createElement(Om,{...u,"aria-current":g,className:v,ref:h,style:E,to:o,viewTransition:c},typeof l=="function"?l(b):l)});uE.displayName="NavLink";var hE=S.forwardRef(({discover:t="render",fetcherKey:e,navigate:n,reloadDocument:r,replace:s,state:i,method:o=Qi,action:c,onSubmit:l,relative:u,preventScrollReset:h,viewTransition:f,unstable_defaultShouldRevalidate:m,...y},w)=>{let{unstable_useTransitions:R}=S.useContext(it),I=gE(),P=yE(c,{relative:u}),x=o.toLowerCase()==="get"?"get":"post",V=typeof c=="string"&&Lm.test(c),L=O=>{if(l&&l(O),O.defaultPrevented)return;O.preventDefault();let z=O.nativeEvent.submitter,b=(z==null?void 0:z.getAttribute("formmethod"))||o,g=()=>I(z||O.currentTarget,{fetcherKey:e,method:b,navigate:n,replace:s,state:i,relative:u,preventScrollReset:h,viewTransition:f,unstable_defaultShouldRevalidate:m});R&&n!==!1?S.startTransition(()=>g()):g()};return S.createElement("form",{ref:w,method:x,action:P,onSubmit:r?l:L,...y,"data-discover":!V&&t==="render"?"true":void 0})});hE.displayName="Form";function dE(t){return`${t} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function Fm(t){let e=S.useContext(Br);return me(e,dE(t)),e}function fE(t,{target:e,replace:n,unstable_mask:r,state:s,preventScrollReset:i,relative:o,viewTransition:c,unstable_defaultShouldRevalidate:l,unstable_useTransitions:u}={}){let h=xm(),f=Lt(),m=ri(t,{relative:o});return S.useCallback(y=>{if(WT(y,e)){y.preventDefault();let w=n!==void 0?n:Bs(f)===Bs(m),R=()=>h(t,{replace:w,unstable_mask:r,state:s,preventScrollReset:i,relative:o,viewTransition:c,unstable_defaultShouldRevalidate:l});u?S.startTransition(()=>R()):R()}},[f,h,m,n,r,s,e,t,i,o,c,l,u])}var pE=0,mE=()=>`__${String(++pE)}__`;function gE(){let{router:t}=Fm("useSubmit"),{basename:e}=S.useContext(it),n=NT(),r=t.fetch,s=t.navigate;return S.useCallback(async(i,o={})=>{let{action:c,method:l,encType:u,formData:h,body:f}=KT(i,e);if(o.navigate===!1){let m=o.fetcherKey||mE();await r(m,n,o.action||c,{unstable_defaultShouldRevalidate:o.unstable_defaultShouldRevalidate,preventScrollReset:o.preventScrollReset,formData:h,body:f,formMethod:o.method||l,formEncType:o.encType||u,flushSync:o.flushSync})}else await s(o.action||c,{unstable_defaultShouldRevalidate:o.unstable_defaultShouldRevalidate,preventScrollReset:o.preventScrollReset,formData:h,body:f,formMethod:o.method||l,formEncType:o.encType||u,replace:o.replace,state:o.state,fromRouteId:n,flushSync:o.flushSync,viewTransition:o.viewTransition})},[r,s,e,n])}function yE(t,{relative:e}={}){let{basename:n}=S.useContext(it),r=S.useContext(Nt);me(r,"useFormAction must be used inside a RouteContext");let[s]=r.matches.slice(-1),i={...ri(t||".",{relative:e})},o=Lt();if(t==null){i.search=o.search;let c=new URLSearchParams(i.search),l=c.getAll("index");if(l.some(h=>h==="")){c.delete("index"),l.filter(f=>f).forEach(f=>c.append("index",f));let h=c.toString();i.search=h?`?${h}`:""}}return(!t||t===".")&&s.route.index&&(i.search=i.search?i.search.replace(/^\?/,"?index&"):"?index"),n!=="/"&&(i.pathname=i.pathname==="/"?n:Rt([n,i.pathname])),Bs(i)}function _E(t,{relative:e}={}){let n=S.useContext(Sm);me(n!=null,"`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");let{basename:r}=Fm("useViewTransitionState"),s=ri(t,{relative:e});if(!n.isTransitioning)return!1;let i=zt(n.currentLocation.pathname,r)||n.currentLocation.pathname,o=zt(n.nextLocation.pathname,r)||n.nextLocation.pathname;return yo(s.pathname,o)!=null||yo(s.pathname,i)!=null}/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vE=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),wE=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,n,r)=>r?r.toUpperCase():n.toLowerCase()),fd=t=>{const e=wE(t);return e.charAt(0).toUpperCase()+e.slice(1)},Um=(...t)=>t.filter((e,n,r)=>!!e&&e.trim()!==""&&r.indexOf(e)===n).join(" ").trim(),TE=t=>{for(const e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var EE={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const IE=S.forwardRef(({color:t="currentColor",size:e=24,strokeWidth:n=2,absoluteStrokeWidth:r,className:s="",children:i,iconNode:o,...c},l)=>S.createElement("svg",{ref:l,...EE,width:e,height:e,stroke:t,strokeWidth:r?Number(n)*24/Number(e):n,className:Um("lucide",s),...!i&&!TE(c)&&{"aria-hidden":"true"},...c},[...o.map(([u,h])=>S.createElement(u,h)),...Array.isArray(i)?i:[i]]));/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W=(t,e)=>{const n=S.forwardRef(({className:r,...s},i)=>S.createElement(IE,{ref:i,iconNode:e,className:Um(`lucide-${vE(fd(t))}`,`lucide-${t}`,r),...s}));return n.displayName=fd(t),n};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bE=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],Y2=W("activity",bE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const AE=[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]],Q2=W("arrow-left",AE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const RE=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],X2=W("arrow-right",RE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const SE=[["path",{d:"m21 16-4 4-4-4",key:"f6ql7i"}],["path",{d:"M17 20V4",key:"1ejh1v"}],["path",{d:"m3 8 4-4 4 4",key:"11wl7u"}],["path",{d:"M7 4v16",key:"1glfcx"}]],J2=W("arrow-up-down",SE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const PE=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],Z2=W("check",PE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const CE=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],eM=W("chevron-down",CE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const kE=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],tM=W("chevron-right",kE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xE=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],nM=W("chevron-up",xE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const VE=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],rM=W("circle-alert",VE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const DE=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],sM=W("circle-check",DE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ME=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],iM=W("circle-x",ME);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const NE=[["path",{d:"M12 6v6l4 2",key:"mmk7yg"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],oM=W("clock",NE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const LE=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],aM=W("copy",LE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const OE=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],cM=W("credit-card",OE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const FE=[["rect",{width:"12",height:"12",x:"2",y:"10",rx:"2",ry:"2",key:"6agr2n"}],["path",{d:"m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6",key:"1o487t"}],["path",{d:"M6 18h.01",key:"uhywen"}],["path",{d:"M10 14h.01",key:"ssrbsk"}],["path",{d:"M15 6h.01",key:"cblpky"}],["path",{d:"M18 9h.01",key:"2061c0"}]],lM=W("dices",FE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const UE=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],uM=W("download",UE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const BE=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],hM=W("external-link",BE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const jE=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],dM=W("file-text",jE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $E=[["path",{d:"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",key:"sc7q7i"}]],fM=W("funnel",$E);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const zE=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",key:"mvr1a0"}]],pM=W("heart",zE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qE=[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"r6nss1"}]],mM=W("house",qE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const WE=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],gM=W("info",WE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const HE=[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]],yM=W("key",HE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const GE=[["path",{d:"m5 8 6 6",key:"1wu5hv"}],["path",{d:"m4 14 6-6 2-3",key:"1k1g8d"}],["path",{d:"M2 5h12",key:"or177f"}],["path",{d:"M7 2h1",key:"1t2jsx"}],["path",{d:"m22 22-5-10-5 10",key:"don7ne"}],["path",{d:"M14 18h6",key:"1m8k6r"}]],_M=W("languages",GE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const KE=[["path",{d:"M9 17H7A5 5 0 0 1 7 7",key:"10o201"}],["path",{d:"M15 7h2a5 5 0 0 1 4 8",key:"1d3206"}],["line",{x1:"8",x2:"12",y1:"12",y2:"12",key:"rvw6j4"}],["line",{x1:"2",x2:"22",y1:"2",y2:"22",key:"a6p6uj"}]],vM=W("link-2-off",KE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const YE=[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]],wM=W("link-2",YE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const QE=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],TM=W("loader-circle",QE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const XE=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 9.9-1",key:"1mm8w8"}]],EM=W("lock-open",XE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const JE=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],IM=W("lock",JE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ZE=[["path",{d:"m10 17 5-5-5-5",key:"1bsop3"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}]],bM=W("log-in",ZE);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const e0=[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]],AM=W("log-out",e0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const t0=[["path",{d:"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",key:"132q7q"}],["rect",{x:"2",y:"4",width:"20",height:"16",rx:"2",key:"izxlao"}]],RM=W("mail",t0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n0=[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]],SM=W("menu",n0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r0=[["path",{d:"M12 19v3",key:"npa21l"}],["path",{d:"M15 9.34V5a3 3 0 0 0-5.68-1.33",key:"1gzdoj"}],["path",{d:"M16.95 16.95A7 7 0 0 1 5 12v-2",key:"cqa7eg"}],["path",{d:"M18.89 13.23A7 7 0 0 0 19 12v-2",key:"16hl24"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M9 9v3a3 3 0 0 0 5.12 2.12",key:"r2i35w"}]],PM=W("mic-off",r0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s0=[["path",{d:"m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12",key:"80a601"}],["path",{d:"M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5",key:"j0ngtp"}],["circle",{cx:"16",cy:"7",r:"5",key:"d08jfb"}]],CM=W("mic-vocal",s0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i0=[["rect",{width:"20",height:"14",x:"2",y:"3",rx:"2",key:"48i651"}],["line",{x1:"8",x2:"16",y1:"21",y2:"21",key:"1svkeh"}],["line",{x1:"12",x2:"12",y1:"17",y2:"21",key:"vw1qmm"}]],kM=W("monitor",i0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o0=[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]],xM=W("moon",o0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a0=[["path",{d:"M9 18V5l12-2v13",key:"1jmyc2"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}],["circle",{cx:"18",cy:"16",r:"3",key:"1hluhg"}]],VM=W("music",a0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c0=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]],DM=W("pen",c0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l0=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89",key:"znwnzq"}],["path",{d:"m2 2 20 20",key:"1ooewy"}],["path",{d:"M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11",key:"c9qhm2"}]],MM=W("pin-off",l0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u0=[["path",{d:"M12 17v5",key:"bb1du9"}],["path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",key:"1nkz8b"}]],NM=W("pin",u0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h0=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],LM=W("plus",h0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d0=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],OM=W("refresh-cw",d0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f0=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],FM=W("rotate-ccw",f0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p0=[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",key:"1c8476"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",key:"1ydtos"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7",key:"t51u73"}]],UM=W("save",p0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m0=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],BM=W("search",m0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g0=[["path",{d:"M14 17H5",key:"gfn3mx"}],["path",{d:"M19 7h-9",key:"6i9tg"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]],jM=W("settings-2",g0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y0=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],$M=W("settings",y0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _0=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]],zM=W("shield",_0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v0=[["path",{d:"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",key:"1s2grr"}],["path",{d:"M20 2v4",key:"1rf3ol"}],["path",{d:"M22 4h-4",key:"gwowj6"}],["circle",{cx:"4",cy:"20",r:"2",key:"6kqj1y"}]],qM=W("sparkles",v0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w0=[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]],WM=W("sun",w0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T0=[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]],HM=W("tag",T0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E0=[["path",{d:"M17 14V2",key:"8ymqnk"}],["path",{d:"M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",key:"m61m77"}]],GM=W("thumbs-down",E0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I0=[["path",{d:"M7 10v12",key:"1qc93n"}],["path",{d:"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",key:"emmmcr"}]],KM=W("thumbs-up",I0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b0=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],YM=W("trash-2",b0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A0=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],QM=W("triangle-alert",A0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R0=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],XM=W("user",R0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S0=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["path",{d:"M16 3.128a4 4 0 0 1 0 7.744",key:"16gr8j"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],JM=W("users",S0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P0=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],ZM=W("x",P0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C0=[["path",{d:"M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17",key:"1q2vi4"}],["path",{d:"m10 15 5-3-5-3z",key:"1jp15x"}]],eN=W("youtube",C0);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k0=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],tN=W("zap",k0),Nl=S.createContext({});function Pn(t){const e=S.useRef(null);return e.current===null&&(e.current=t()),e.current}const x0=typeof window<"u",Ll=x0?S.useLayoutEffect:S.useEffect,Xo=S.createContext(null);function Ol(t,e){t.indexOf(e)===-1&&t.push(e)}function _o(t,e){const n=t.indexOf(e);n>-1&&t.splice(n,1)}function V0([...t],e,n){const r=e<0?t.length+e:e;if(r>=0&&r<t.length){const s=n<0?t.length+n:n,[i]=t.splice(e,1);t.splice(s,0,i)}return t}const Vt=(t,e,n)=>n>e?e:n<t?t:n;let Fl=()=>{};const wn={},Bm=t=>/^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(t);function jm(t){return typeof t=="object"&&t!==null}const $m=t=>/^0[^.\s]+$/u.test(t);function zm(t){let e;return()=>(e===void 0&&(e=t()),e)}const ut=t=>t,D0=(t,e)=>n=>e(t(n)),si=(...t)=>t.reduce(D0),js=(t,e,n)=>{const r=e-t;return r===0?1:(n-t)/r};class Ul{constructor(){this.subscriptions=[]}add(e){return Ol(this.subscriptions,e),()=>_o(this.subscriptions,e)}notify(e,n,r){const s=this.subscriptions.length;if(s)if(s===1)this.subscriptions[0](e,n,r);else for(let i=0;i<s;i++){const o=this.subscriptions[i];o&&o(e,n,r)}}getSize(){return this.subscriptions.length}clear(){this.subscriptions.length=0}}const st=t=>t*1e3,ct=t=>t/1e3;function qm(t,e){return e?t*(1e3/e):0}const Wm=(t,e,n)=>(((1-3*n+3*e)*t+(3*n-6*e))*t+3*e)*t,M0=1e-7,N0=12;function L0(t,e,n,r,s){let i,o,c=0;do o=e+(n-e)/2,i=Wm(o,r,s)-t,i>0?n=o:e=o;while(Math.abs(i)>M0&&++c<N0);return o}function ii(t,e,n,r){if(t===e&&n===r)return ut;const s=i=>L0(i,0,1,t,n);return i=>i===0||i===1?i:Wm(s(i),e,r)}const Hm=t=>e=>e<=.5?t(2*e)/2:(2-t(2*(1-e)))/2,Gm=t=>e=>1-t(1-e),Km=ii(.33,1.53,.69,.99),Bl=Gm(Km),Ym=Hm(Bl),Qm=t=>t>=1?1:(t*=2)<1?.5*Bl(t):.5*(2-Math.pow(2,-10*(t-1))),jl=t=>1-Math.sin(Math.acos(t)),Xm=Gm(jl),Jm=Hm(jl),O0=ii(.42,0,1,1),F0=ii(0,0,.58,1),Zm=ii(.42,0,.58,1),U0=t=>Array.isArray(t)&&typeof t[0]!="number",eg=t=>Array.isArray(t)&&typeof t[0]=="number",B0={linear:ut,easeIn:O0,easeInOut:Zm,easeOut:F0,circIn:jl,circInOut:Jm,circOut:Xm,backIn:Bl,backInOut:Ym,backOut:Km,anticipate:Qm},j0=t=>typeof t=="string",pd=t=>{if(eg(t)){Fl(t.length===4);const[e,n,r,s]=t;return ii(e,n,r,s)}else if(j0(t))return B0[t];return t},Li=["setup","read","resolveKeyframes","preUpdate","update","preRender","render","postRender"];function $0(t,e){let n=new Set,r=new Set,s=!1,i=!1;const o=new WeakSet;let c={delta:0,timestamp:0,isProcessing:!1};function l(h){o.has(h)&&(u.schedule(h),t()),h(c)}const u={schedule:(h,f=!1,m=!1)=>{const w=m&&s?n:r;return f&&o.add(h),w.add(h),h},cancel:h=>{r.delete(h),o.delete(h)},process:h=>{if(c=h,s){i=!0;return}s=!0;const f=n;n=r,r=f,n.forEach(l),n.clear(),s=!1,i&&(i=!1,u.process(h))}};return u}const z0=40;function tg(t,e){let n=!1,r=!0;const s={delta:0,timestamp:0,isProcessing:!1},i=()=>n=!0,o=Li.reduce((V,L)=>(V[L]=$0(i),V),{}),{setup:c,read:l,resolveKeyframes:u,preUpdate:h,update:f,preRender:m,render:y,postRender:w}=o,R=()=>{const V=wn.useManualTiming,L=V?s.timestamp:performance.now();n=!1,V||(s.delta=r?1e3/60:Math.max(Math.min(L-s.timestamp,z0),1)),s.timestamp=L,s.isProcessing=!0,c.process(s),l.process(s),u.process(s),h.process(s),f.process(s),m.process(s),y.process(s),w.process(s),s.isProcessing=!1,n&&e&&(r=!1,t(R))},I=()=>{n=!0,r=!0,s.isProcessing||t(R)};return{schedule:Li.reduce((V,L)=>{const O=o[L];return V[L]=(z,b=!1,g=!1)=>(n||I(),O.schedule(z,b,g)),V},{}),cancel:V=>{for(let L=0;L<Li.length;L++)o[Li[L]].cancel(V)},state:s,steps:o}}const{schedule:ae,cancel:qt,state:Oe,steps:Ka}=tg(typeof requestAnimationFrame<"u"?requestAnimationFrame:ut,!0);let Ji;function q0(){Ji=void 0}const Ye={now:()=>(Ji===void 0&&Ye.set(Oe.isProcessing||wn.useManualTiming?Oe.timestamp:performance.now()),Ji),set:t=>{Ji=t,queueMicrotask(q0)}},ng=t=>e=>typeof e=="string"&&e.startsWith(t),rg=ng("--"),W0=ng("var(--"),$l=t=>W0(t)?H0.test(t.split("/*")[0].trim()):!1,H0=/var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;function md(t){return typeof t!="string"?!1:t.split("/*")[0].includes("var(--")}const $r={test:t=>typeof t=="number",parse:parseFloat,transform:t=>t},$s={...$r,transform:t=>Vt(0,1,t)},Oi={...$r,default:1},Ps=t=>Math.round(t*1e5)/1e5,zl=/-?(?:\d+(?:\.\d+)?|\.\d+)/gu;function G0(t){return t==null}const K0=/^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu,ql=(t,e)=>n=>!!(typeof n=="string"&&K0.test(n)&&n.startsWith(t)||e&&!G0(n)&&Object.prototype.hasOwnProperty.call(n,e)),sg=(t,e,n)=>r=>{if(typeof r!="string")return r;const[s,i,o,c]=r.match(zl);return{[t]:parseFloat(s),[e]:parseFloat(i),[n]:parseFloat(o),alpha:c!==void 0?parseFloat(c):1}},Y0=t=>Vt(0,255,t),Ya={...$r,transform:t=>Math.round(Y0(t))},Gn={test:ql("rgb","red"),parse:sg("red","green","blue"),transform:({red:t,green:e,blue:n,alpha:r=1})=>"rgba("+Ya.transform(t)+", "+Ya.transform(e)+", "+Ya.transform(n)+", "+Ps($s.transform(r))+")"};function Q0(t){let e="",n="",r="",s="";return t.length>5?(e=t.substring(1,3),n=t.substring(3,5),r=t.substring(5,7),s=t.substring(7,9)):(e=t.substring(1,2),n=t.substring(2,3),r=t.substring(3,4),s=t.substring(4,5),e+=e,n+=n,r+=r,s+=s),{red:parseInt(e,16),green:parseInt(n,16),blue:parseInt(r,16),alpha:s?parseInt(s,16)/255:1}}const Cc={test:ql("#"),parse:Q0,transform:Gn.transform},oi=t=>({test:e=>typeof e=="string"&&e.endsWith(t)&&e.split(" ").length===1,parse:parseFloat,transform:e=>`${e}${t}`}),an=oi("deg"),St=oi("%"),$=oi("px"),X0=oi("vh"),J0=oi("vw"),gd={...St,parse:t=>St.parse(t)/100,transform:t=>St.transform(t*100)},Ir={test:ql("hsl","hue"),parse:sg("hue","saturation","lightness"),transform:({hue:t,saturation:e,lightness:n,alpha:r=1})=>"hsla("+Math.round(t)+", "+St.transform(Ps(e))+", "+St.transform(Ps(n))+", "+Ps($s.transform(r))+")"},Ae={test:t=>Gn.test(t)||Cc.test(t)||Ir.test(t),parse:t=>Gn.test(t)?Gn.parse(t):Ir.test(t)?Ir.parse(t):Cc.parse(t),transform:t=>typeof t=="string"?t:t.hasOwnProperty("red")?Gn.transform(t):Ir.transform(t),getAnimatableNone:t=>{const e=Ae.parse(t);return e.alpha=0,Ae.transform(e)}},Z0=/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;function eI(t){var e,n;return isNaN(t)&&typeof t=="string"&&(((e=t.match(zl))==null?void 0:e.length)||0)+(((n=t.match(Z0))==null?void 0:n.length)||0)>0}const ig="number",og="color",tI="var",nI="var(",yd="${}",rI=/var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;function xr(t){const e=t.toString(),n=[],r={color:[],number:[],var:[]},s=[];let i=0;const c=e.replace(rI,l=>(Ae.test(l)?(r.color.push(i),s.push(og),n.push(Ae.parse(l))):l.startsWith(nI)?(r.var.push(i),s.push(tI),n.push(l)):(r.number.push(i),s.push(ig),n.push(parseFloat(l))),++i,yd)).split(yd);return{values:n,split:c,indexes:r,types:s}}function sI(t){return xr(t).values}function ag({split:t,types:e}){const n=t.length;return r=>{let s="";for(let i=0;i<n;i++)if(s+=t[i],r[i]!==void 0){const o=e[i];o===ig?s+=Ps(r[i]):o===og?s+=Ae.transform(r[i]):s+=r[i]}return s}}function iI(t){return ag(xr(t))}const oI=t=>typeof t=="number"?0:Ae.test(t)?Ae.getAnimatableNone(t):t,aI=(t,e)=>typeof t=="number"?e!=null&&e.trim().endsWith("/")?t:0:oI(t);function cI(t){const e=xr(t);return ag(e)(e.values.map((r,s)=>aI(r,e.split[s])))}const pt={test:eI,parse:sI,createTransformer:iI,getAnimatableNone:cI};function Qa(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*(2/3-n)*6:t}function lI({hue:t,saturation:e,lightness:n,alpha:r}){t/=360,e/=100,n/=100;let s=0,i=0,o=0;if(!e)s=i=o=n;else{const c=n<.5?n*(1+e):n+e-n*e,l=2*n-c;s=Qa(l,c,t+1/3),i=Qa(l,c,t),o=Qa(l,c,t-1/3)}return{red:Math.round(s*255),green:Math.round(i*255),blue:Math.round(o*255),alpha:r}}function vo(t,e){return n=>n>0?e:t}const he=(t,e,n)=>t+(e-t)*n,Xa=(t,e,n)=>{const r=t*t,s=n*(e*e-r)+r;return s<0?0:Math.sqrt(s)},uI=[Cc,Gn,Ir],hI=t=>uI.find(e=>e.test(t));function _d(t){const e=hI(t);if(!e)return!1;let n=e.parse(t);return e===Ir&&(n=lI(n)),n}const vd=(t,e)=>{const n=_d(t),r=_d(e);if(!n||!r)return vo(t,e);const s={...n};return i=>(s.red=Xa(n.red,r.red,i),s.green=Xa(n.green,r.green,i),s.blue=Xa(n.blue,r.blue,i),s.alpha=he(n.alpha,r.alpha,i),Gn.transform(s))},kc=new Set(["none","hidden"]);function dI(t,e){return kc.has(t)?n=>n<=0?t:e:n=>n>=1?e:t}function fI(t,e){return n=>he(t,e,n)}function Wl(t){return typeof t=="number"?fI:typeof t=="string"?$l(t)?vo:Ae.test(t)?vd:gI:Array.isArray(t)?cg:typeof t=="object"?Ae.test(t)?vd:pI:vo}function cg(t,e){const n=[...t],r=n.length,s=t.map((i,o)=>Wl(i)(i,e[o]));return i=>{for(let o=0;o<r;o++)n[o]=s[o](i);return n}}function pI(t,e){const n={...t,...e},r={};for(const s in n)t[s]!==void 0&&e[s]!==void 0&&(r[s]=Wl(t[s])(t[s],e[s]));return s=>{for(const i in r)n[i]=r[i](s);return n}}function mI(t,e){const n=[],r={color:0,var:0,number:0};for(let s=0;s<e.values.length;s++){const i=e.types[s],o=t.indexes[i][r[i]],c=t.values[o]??0;n[s]=c,r[i]++}return n}const gI=(t,e)=>{const n=pt.createTransformer(e),r=xr(t),s=xr(e);return r.indexes.var.length===s.indexes.var.length&&r.indexes.color.length===s.indexes.color.length&&r.indexes.number.length>=s.indexes.number.length?kc.has(t)&&!s.values.length||kc.has(e)&&!r.values.length?dI(t,e):si(cg(mI(r,s),s.values),n):vo(t,e)};function lg(t,e,n){return typeof t=="number"&&typeof e=="number"&&typeof n=="number"?he(t,e,n):Wl(t)(t,e)}const yI=t=>{const e=({timestamp:n})=>t(n);return{start:(n=!0)=>ae.update(e,n),stop:()=>qt(e),now:()=>Oe.isProcessing?Oe.timestamp:Ye.now()}},ug=(t,e,n=10)=>{let r="";const s=Math.max(Math.round(e/n),2);for(let i=0;i<s;i++)r+=Math.round(t(i/(s-1))*1e4)/1e4+", ";return`linear(${r.substring(0,r.length-2)})`},wo=2e4;function Hl(t){let e=0;const n=50;let r=t.next(e);for(;!r.done&&e<wo;)e+=n,r=t.next(e);return e>=wo?1/0:e}function _I(t,e=100,n){const r=n({...t,keyframes:[0,e]}),s=Math.min(Hl(r),wo);return{type:"keyframes",ease:i=>r.next(s*i).value/e,duration:ct(s)}}const we={stiffness:100,damping:10,mass:1,velocity:0,duration:800,bounce:.3,visualDuration:.3,restSpeed:{granular:.01,default:2},restDelta:{granular:.005,default:.5},minDuration:.01,maxDuration:10,minDamping:.05,maxDamping:1};function xc(t,e){return t*Math.sqrt(1-e*e)}const vI=12;function wI(t,e,n){let r=n;for(let s=1;s<vI;s++)r=r-t(r)/e(r);return r}const Ja=.001;function TI({duration:t=we.duration,bounce:e=we.bounce,velocity:n=we.velocity,mass:r=we.mass}){let s,i,o=1-e;o=Vt(we.minDamping,we.maxDamping,o),t=Vt(we.minDuration,we.maxDuration,ct(t)),o<1?(s=u=>{const h=u*o,f=h*t,m=h-n,y=xc(u,o),w=Math.exp(-f);return Ja-m/y*w},i=u=>{const f=u*o*t,m=f*n+n,y=Math.pow(o,2)*Math.pow(u,2)*t,w=Math.exp(-f),R=xc(Math.pow(u,2),o);return(-s(u)+Ja>0?-1:1)*((m-y)*w)/R}):(s=u=>{const h=Math.exp(-u*t),f=(u-n)*t+1;return-Ja+h*f},i=u=>{const h=Math.exp(-u*t),f=(n-u)*(t*t);return h*f});const c=5/t,l=wI(s,i,c);if(t=st(t),isNaN(l))return{stiffness:we.stiffness,damping:we.damping,duration:t};{const u=Math.pow(l,2)*r;return{stiffness:u,damping:o*2*Math.sqrt(r*u),duration:t}}}const EI=["duration","bounce"],II=["stiffness","damping","mass"];function wd(t,e){return e.some(n=>t[n]!==void 0)}function bI(t){let e={velocity:we.velocity,stiffness:we.stiffness,damping:we.damping,mass:we.mass,isResolvedFromDuration:!1,...t};if(!wd(t,II)&&wd(t,EI))if(e.velocity=0,t.visualDuration){const n=t.visualDuration,r=2*Math.PI/(n*1.2),s=r*r,i=2*Vt(.05,1,1-(t.bounce||0))*Math.sqrt(s);e={...e,mass:we.mass,stiffness:s,damping:i}}else{const n=TI({...t,velocity:0});e={...e,...n,mass:we.mass},e.isResolvedFromDuration=!0}return e}function To(t=we.visualDuration,e=we.bounce){const n=typeof t!="object"?{visualDuration:t,keyframes:[0,1],bounce:e}:t;let{restSpeed:r,restDelta:s}=n;const i=n.keyframes[0],o=n.keyframes[n.keyframes.length-1],c={done:!1,value:i},{stiffness:l,damping:u,mass:h,duration:f,velocity:m,isResolvedFromDuration:y}=bI({...n,velocity:-ct(n.velocity||0)}),w=m||0,R=u/(2*Math.sqrt(l*h)),I=o-i,P=ct(Math.sqrt(l/h)),x=Math.abs(I)<5;r||(r=x?we.restSpeed.granular:we.restSpeed.default),s||(s=x?we.restDelta.granular:we.restDelta.default);let V,L,O,z,b,g;if(R<1)O=xc(P,R),z=(w+R*P*I)/O,V=E=>{const A=Math.exp(-R*P*E);return o-A*(z*Math.sin(O*E)+I*Math.cos(O*E))},b=R*P*z+I*O,g=R*P*I-z*O,L=E=>Math.exp(-R*P*E)*(b*Math.sin(O*E)+g*Math.cos(O*E));else if(R===1){V=A=>o-Math.exp(-P*A)*(I+(w+P*I)*A);const E=w+P*I;L=A=>Math.exp(-P*A)*(P*E*A-w)}else{const E=P*Math.sqrt(R*R-1);V=ie=>{const se=Math.exp(-R*P*ie),pe=Math.min(E*ie,300);return o-se*((w+R*P*I)*Math.sinh(pe)+E*I*Math.cosh(pe))/E};const A=(w+R*P*I)/E,C=R*P*A-I*E,T=R*P*I-A*E;L=ie=>{const se=Math.exp(-R*P*ie),pe=Math.min(E*ie,300);return se*(C*Math.sinh(pe)+T*Math.cosh(pe))}}const v={calculatedDuration:y&&f||null,velocity:E=>st(L(E)),next:E=>{if(!y&&R<1){const C=Math.exp(-R*P*E),T=Math.sin(O*E),ie=Math.cos(O*E),se=o-C*(z*T+I*ie),pe=st(C*(b*T+g*ie));return c.done=Math.abs(pe)<=r&&Math.abs(o-se)<=s,c.value=c.done?o:se,c}const A=V(E);if(y)c.done=E>=f;else{const C=st(L(E));c.done=Math.abs(C)<=r&&Math.abs(o-A)<=s}return c.value=c.done?o:A,c},toString:()=>{const E=Math.min(Hl(v),wo),A=ug(C=>v.next(E*C).value,E,30);return E+"ms "+A},toTransition:()=>{}};return v}To.applyToOptions=t=>{const e=_I(t,100,To);return t.ease=e.ease,t.duration=st(e.duration),t.type="keyframes",t};const AI=5;function hg(t,e,n){const r=Math.max(e-AI,0);return qm(n-t(r),e-r)}function Vc({keyframes:t,velocity:e=0,power:n=.8,timeConstant:r=325,bounceDamping:s=10,bounceStiffness:i=500,modifyTarget:o,min:c,max:l,restDelta:u=.5,restSpeed:h}){const f=t[0],m={done:!1,value:f},y=g=>c!==void 0&&g<c||l!==void 0&&g>l,w=g=>c===void 0?l:l===void 0||Math.abs(c-g)<Math.abs(l-g)?c:l;let R=n*e;const I=f+R,P=o===void 0?I:o(I);P!==I&&(R=P-f);const x=g=>-R*Math.exp(-g/r),V=g=>P+x(g),L=g=>{const v=x(g),E=V(g);m.done=Math.abs(v)<=u,m.value=m.done?P:E};let O,z;const b=g=>{y(m.value)&&(O=g,z=To({keyframes:[m.value,w(m.value)],velocity:hg(V,g,m.value),damping:s,stiffness:i,restDelta:u,restSpeed:h}))};return b(0),{calculatedDuration:null,next:g=>{let v=!1;return!z&&O===void 0&&(v=!0,L(g),b(g)),O!==void 0&&g>=O?z.next(g-O):(!v&&L(g),m)}}}function RI(t,e,n){const r=[],s=n||wn.mix||lg,i=t.length-1;for(let o=0;o<i;o++){let c=s(t[o],t[o+1]);if(e){const l=Array.isArray(e)?e[o]||ut:e;c=si(l,c)}r.push(c)}return r}function dg(t,e,{clamp:n=!0,ease:r,mixer:s}={}){const i=t.length;if(Fl(i===e.length),i===1)return()=>e[0];if(i===2&&e[0]===e[1])return()=>e[1];const o=t[0]===t[1];t[0]>t[i-1]&&(t=[...t].reverse(),e=[...e].reverse());const c=RI(e,r,s),l=c.length,u=h=>{if(o&&h<t[0])return e[0];let f=0;if(l>1)for(;f<t.length-2&&!(h<t[f+1]);f++);const m=js(t[f],t[f+1],h);return c[f](m)};return n?h=>u(Vt(t[0],t[i-1],h)):u}function SI(t,e){const n=t[t.length-1];for(let r=1;r<=e;r++){const s=js(0,e,r);t.push(he(n,1,s))}}function PI(t){const e=[0];return SI(e,t.length-1),e}function CI(t,e){return t.map(n=>n*e)}function kI(t,e){return t.map(()=>e||Zm).splice(0,t.length-1)}function Cs({duration:t=300,keyframes:e,times:n,ease:r="easeInOut"}){const s=U0(r)?r.map(pd):pd(r),i={done:!1,value:e[0]},o=CI(n&&n.length===e.length?n:PI(e),t),c=dg(o,e,{ease:Array.isArray(s)?s:kI(e,s)});return{calculatedDuration:t,next:l=>(i.value=c(l),i.done=l>=t,i)}}const xI=t=>t!==null;function Jo(t,{repeat:e,repeatType:n="loop"},r,s=1){const i=t.filter(xI),c=s<0||e&&n!=="loop"&&e%2===1?0:i.length-1;return!c||r===void 0?i[c]:r}const VI={decay:Vc,inertia:Vc,tween:Cs,keyframes:Cs,spring:To};function fg(t){typeof t.type=="string"&&(t.type=VI[t.type])}class Gl{constructor(){this.updateFinished()}get finished(){return this._finished}updateFinished(){this._finished=new Promise(e=>{this.resolve=e})}notifyFinished(){this.resolve()}then(e,n){return this.finished.then(e,n)}}const DI=t=>t/100;class Eo extends Gl{constructor(e){super(),this.state="idle",this.startTime=null,this.isStopped=!1,this.currentTime=0,this.holdTime=null,this.playbackSpeed=1,this.delayState={done:!1,value:void 0},this.stop=()=>{var r,s;const{motionValue:n}=this.options;n&&n.updatedAt!==Ye.now()&&this.tick(Ye.now()),this.isStopped=!0,this.state!=="idle"&&(this.teardown(),(s=(r=this.options).onStop)==null||s.call(r))},this.options=e,this.initAnimation(),this.play(),e.autoplay===!1&&this.pause()}initAnimation(){const{options:e}=this;fg(e);const{type:n=Cs,repeat:r=0,repeatDelay:s=0,repeatType:i,velocity:o=0}=e;let{keyframes:c}=e;const l=n||Cs;l!==Cs&&typeof c[0]!="number"&&(this.mixKeyframes=si(DI,lg(c[0],c[1])),c=[0,100]);const u=l({...e,keyframes:c});i==="mirror"&&(this.mirroredGenerator=l({...e,keyframes:[...c].reverse(),velocity:-o})),u.calculatedDuration===null&&(u.calculatedDuration=Hl(u));const{calculatedDuration:h}=u;this.calculatedDuration=h,this.resolvedDuration=h+s,this.totalDuration=this.resolvedDuration*(r+1)-s,this.generator=u}updateTime(e){const n=Math.round(e-this.startTime)*this.playbackSpeed;this.holdTime!==null?this.currentTime=this.holdTime:this.currentTime=n}tick(e,n=!1){const{generator:r,totalDuration:s,mixKeyframes:i,mirroredGenerator:o,resolvedDuration:c,calculatedDuration:l}=this;if(this.startTime===null)return r.next(0);const{delay:u=0,keyframes:h,repeat:f,repeatType:m,repeatDelay:y,type:w,onUpdate:R,finalKeyframe:I}=this.options;this.speed>0?this.startTime=Math.min(this.startTime,e):this.speed<0&&(this.startTime=Math.min(e-s/this.speed,this.startTime)),n?this.currentTime=e:this.updateTime(e);const P=this.currentTime-u*(this.playbackSpeed>=0?1:-1),x=this.playbackSpeed>=0?P<0:P>s;this.currentTime=Math.max(P,0),this.state==="finished"&&this.holdTime===null&&(this.currentTime=s);let V=this.currentTime,L=r;if(f){const g=Math.min(this.currentTime,s)/c;let v=Math.floor(g),E=g%1;!E&&g>=1&&(E=1),E===1&&v--,v=Math.min(v,f+1),!!(v%2)&&(m==="reverse"?(E=1-E,y&&(E-=y/c)):m==="mirror"&&(L=o)),V=Vt(0,1,E)*c}let O;x?(this.delayState.value=h[0],O=this.delayState):O=L.next(V),i&&!x&&(O.value=i(O.value));let{done:z}=O;!x&&l!==null&&(z=this.playbackSpeed>=0?this.currentTime>=s:this.currentTime<=0);const b=this.holdTime===null&&(this.state==="finished"||this.state==="running"&&z);return b&&w!==Vc&&(O.value=Jo(h,this.options,I,this.speed)),R&&R(O.value),b&&this.finish(),O}then(e,n){return this.finished.then(e,n)}get duration(){return ct(this.calculatedDuration)}get iterationDuration(){const{delay:e=0}=this.options||{};return this.duration+ct(e)}get time(){return ct(this.currentTime)}set time(e){e=st(e),this.currentTime=e,this.startTime===null||this.holdTime!==null||this.playbackSpeed===0?this.holdTime=e:this.driver&&(this.startTime=this.driver.now()-e/this.playbackSpeed),this.driver?this.driver.start(!1):(this.startTime=0,this.state="paused",this.holdTime=e,this.tick(e))}getGeneratorVelocity(){const e=this.currentTime;if(e<=0)return this.options.velocity||0;if(this.generator.velocity)return this.generator.velocity(e);const n=this.generator.next(e).value;return hg(r=>this.generator.next(r).value,e,n)}get speed(){return this.playbackSpeed}set speed(e){const n=this.playbackSpeed!==e;n&&this.driver&&this.updateTime(Ye.now()),this.playbackSpeed=e,n&&this.driver&&(this.time=ct(this.currentTime))}play(){var s,i;if(this.isStopped)return;const{driver:e=yI,startTime:n}=this.options;this.driver||(this.driver=e(o=>this.tick(o))),(i=(s=this.options).onPlay)==null||i.call(s);const r=this.driver.now();this.state==="finished"?(this.updateFinished(),this.startTime=r):this.holdTime!==null?this.startTime=r-this.holdTime:this.startTime||(this.startTime=n??r),this.state==="finished"&&this.speed<0&&(this.startTime+=this.calculatedDuration),this.holdTime=null,this.state="running",this.driver.start()}pause(){this.state="paused",this.updateTime(Ye.now()),this.holdTime=this.currentTime}complete(){this.state!=="running"&&this.play(),this.state="finished",this.holdTime=null}finish(){var e,n;this.notifyFinished(),this.teardown(),this.state="finished",(n=(e=this.options).onComplete)==null||n.call(e)}cancel(){var e,n;this.holdTime=null,this.startTime=0,this.tick(0),this.teardown(),(n=(e=this.options).onCancel)==null||n.call(e)}teardown(){this.state="idle",this.stopDriver(),this.startTime=this.holdTime=null}stopDriver(){this.driver&&(this.driver.stop(),this.driver=void 0)}sample(e){return this.startTime=0,this.tick(e,!0)}attachTimeline(e){var n;return this.options.allowFlatten&&(this.options.type="keyframes",this.options.ease="linear",this.initAnimation()),(n=this.driver)==null||n.stop(),e.observe(this)}}function MI(t){for(let e=1;e<t.length;e++)t[e]??(t[e]=t[e-1])}const Kn=t=>t*180/Math.PI,Dc=t=>{const e=Kn(Math.atan2(t[1],t[0]));return Mc(e)},NI={x:4,y:5,translateX:4,translateY:5,scaleX:0,scaleY:3,scale:t=>(Math.abs(t[0])+Math.abs(t[3]))/2,rotate:Dc,rotateZ:Dc,skewX:t=>Kn(Math.atan(t[1])),skewY:t=>Kn(Math.atan(t[2])),skew:t=>(Math.abs(t[1])+Math.abs(t[2]))/2},Mc=t=>(t=t%360,t<0&&(t+=360),t),Td=Dc,Ed=t=>Math.sqrt(t[0]*t[0]+t[1]*t[1]),Id=t=>Math.sqrt(t[4]*t[4]+t[5]*t[5]),LI={x:12,y:13,z:14,translateX:12,translateY:13,translateZ:14,scaleX:Ed,scaleY:Id,scale:t=>(Ed(t)+Id(t))/2,rotateX:t=>Mc(Kn(Math.atan2(t[6],t[5]))),rotateY:t=>Mc(Kn(Math.atan2(-t[2],t[0]))),rotateZ:Td,rotate:Td,skewX:t=>Kn(Math.atan(t[4])),skewY:t=>Kn(Math.atan(t[1])),skew:t=>(Math.abs(t[1])+Math.abs(t[4]))/2};function Nc(t){return t.includes("scale")?1:0}function Lc(t,e){if(!t||t==="none")return Nc(e);const n=t.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);let r,s;if(n)r=LI,s=n;else{const c=t.match(/^matrix\(([-\d.e\s,]+)\)$/u);r=NI,s=c}if(!s)return Nc(e);const i=r[e],o=s[1].split(",").map(FI);return typeof i=="function"?i(o):o[i]}const OI=(t,e)=>{const{transform:n="none"}=getComputedStyle(t);return Lc(n,e)};function FI(t){return parseFloat(t.trim())}const zr=["transformPerspective","x","y","z","translateX","translateY","translateZ","scale","scaleX","scaleY","rotate","rotateX","rotateY","rotateZ","skew","skewX","skewY"],qr=new Set(zr),bd=t=>t===$r||t===$,UI=new Set(["x","y","z"]),BI=zr.filter(t=>!UI.has(t));function jI(t){const e=[];return BI.forEach(n=>{const r=t.getValue(n);r!==void 0&&(e.push([n,r.get()]),r.set(n.startsWith("scale")?1:0))}),e}const fn={width:({x:t},{paddingLeft:e="0",paddingRight:n="0",boxSizing:r})=>{const s=t.max-t.min;return r==="border-box"?s:s-parseFloat(e)-parseFloat(n)},height:({y:t},{paddingTop:e="0",paddingBottom:n="0",boxSizing:r})=>{const s=t.max-t.min;return r==="border-box"?s:s-parseFloat(e)-parseFloat(n)},top:(t,{top:e})=>parseFloat(e),left:(t,{left:e})=>parseFloat(e),bottom:({y:t},{top:e})=>parseFloat(e)+(t.max-t.min),right:({x:t},{left:e})=>parseFloat(e)+(t.max-t.min),x:(t,{transform:e})=>Lc(e,"x"),y:(t,{transform:e})=>Lc(e,"y")};fn.translateX=fn.x;fn.translateY=fn.y;const Xn=new Set;let Oc=!1,Fc=!1,Uc=!1;function pg(){if(Fc){const t=Array.from(Xn).filter(r=>r.needsMeasurement),e=new Set(t.map(r=>r.element)),n=new Map;e.forEach(r=>{const s=jI(r);s.length&&(n.set(r,s),r.render())}),t.forEach(r=>r.measureInitialState()),e.forEach(r=>{r.render();const s=n.get(r);s&&s.forEach(([i,o])=>{var c;(c=r.getValue(i))==null||c.set(o)})}),t.forEach(r=>r.measureEndState()),t.forEach(r=>{r.suspendedScrollY!==void 0&&window.scrollTo(0,r.suspendedScrollY)})}Fc=!1,Oc=!1,Xn.forEach(t=>t.complete(Uc)),Xn.clear()}function mg(){Xn.forEach(t=>{t.readKeyframes(),t.needsMeasurement&&(Fc=!0)})}function $I(){Uc=!0,mg(),pg(),Uc=!1}class Kl{constructor(e,n,r,s,i,o=!1){this.state="pending",this.isAsync=!1,this.needsMeasurement=!1,this.unresolvedKeyframes=[...e],this.onComplete=n,this.name=r,this.motionValue=s,this.element=i,this.isAsync=o}scheduleResolve(){this.state="scheduled",this.isAsync?(Xn.add(this),Oc||(Oc=!0,ae.read(mg),ae.resolveKeyframes(pg))):(this.readKeyframes(),this.complete())}readKeyframes(){const{unresolvedKeyframes:e,name:n,element:r,motionValue:s}=this;if(e[0]===null){const i=s==null?void 0:s.get(),o=e[e.length-1];if(i!==void 0)e[0]=i;else if(r&&n){const c=r.readValue(n,o);c!=null&&(e[0]=c)}e[0]===void 0&&(e[0]=o),s&&i===void 0&&s.set(e[0])}MI(e)}setFinalKeyframe(){}measureInitialState(){}renderEndStyles(){}measureEndState(){}complete(e=!1){this.state="complete",this.onComplete(this.unresolvedKeyframes,this.finalKeyframe,e),Xn.delete(this)}cancel(){this.state==="scheduled"&&(Xn.delete(this),this.state="pending")}resume(){this.state==="pending"&&this.scheduleResolve()}}const zI=t=>t.startsWith("--");function gg(t,e,n){zI(e)?t.style.setProperty(e,n):t.style[e]=n}const qI={};function yg(t,e){const n=zm(t);return()=>qI[e]??n()}const WI=yg(()=>window.ScrollTimeline!==void 0,"scrollTimeline"),_g=yg(()=>{try{document.createElement("div").animate({opacity:0},{easing:"linear(0, 1)"})}catch{return!1}return!0},"linearEasing"),Es=([t,e,n,r])=>`cubic-bezier(${t}, ${e}, ${n}, ${r})`,Ad={linear:"linear",ease:"ease",easeIn:"ease-in",easeOut:"ease-out",easeInOut:"ease-in-out",circIn:Es([0,.65,.55,1]),circOut:Es([.55,0,1,.45]),backIn:Es([.31,.01,.66,-.59]),backOut:Es([.33,1.53,.69,.99])};function vg(t,e){if(t)return typeof t=="function"?_g()?ug(t,e):"ease-out":eg(t)?Es(t):Array.isArray(t)?t.map(n=>vg(n,e)||Ad.easeOut):Ad[t]}function HI(t,e,n,{delay:r=0,duration:s=300,repeat:i=0,repeatType:o="loop",ease:c="easeOut",times:l}={},u=void 0){const h={[e]:n};l&&(h.offset=l);const f=vg(c,s);Array.isArray(f)&&(h.easing=f);const m={delay:r,duration:s,easing:Array.isArray(f)?"linear":f,fill:"both",iterations:i+1,direction:o==="reverse"?"alternate":"normal"};return u&&(m.pseudoElement=u),t.animate(h,m)}function wg(t){return typeof t=="function"&&"applyToOptions"in t}function GI({type:t,...e}){return wg(t)&&_g()?t.applyToOptions(e):(e.duration??(e.duration=300),e.ease??(e.ease="easeOut"),e)}class Tg extends Gl{constructor(e){if(super(),this.finishedTime=null,this.isStopped=!1,this.manualStartTime=null,!e)return;const{element:n,name:r,keyframes:s,pseudoElement:i,allowFlatten:o=!1,finalKeyframe:c,onComplete:l}=e;this.isPseudoElement=!!i,this.allowFlatten=o,this.options=e,Fl(typeof e.type!="string");const u=GI(e);this.animation=HI(n,r,s,u,i),u.autoplay===!1&&this.animation.pause(),this.animation.onfinish=()=>{if(this.finishedTime=this.time,!i){const h=Jo(s,this.options,c,this.speed);this.updateMotionValue&&this.updateMotionValue(h),gg(n,r,h),this.animation.cancel()}l==null||l(),this.notifyFinished()}}play(){this.isStopped||(this.manualStartTime=null,this.animation.play(),this.state==="finished"&&this.updateFinished())}pause(){this.animation.pause()}complete(){var e,n;(n=(e=this.animation).finish)==null||n.call(e)}cancel(){try{this.animation.cancel()}catch{}}stop(){if(this.isStopped)return;this.isStopped=!0;const{state:e}=this;e==="idle"||e==="finished"||(this.updateMotionValue?this.updateMotionValue():this.commitStyles(),this.isPseudoElement||this.cancel())}commitStyles(){var n,r,s;const e=(n=this.options)==null?void 0:n.element;!this.isPseudoElement&&(e!=null&&e.isConnected)&&((s=(r=this.animation).commitStyles)==null||s.call(r))}get duration(){var n,r;const e=((r=(n=this.animation.effect)==null?void 0:n.getComputedTiming)==null?void 0:r.call(n).duration)||0;return ct(Number(e))}get iterationDuration(){const{delay:e=0}=this.options||{};return this.duration+ct(e)}get time(){return ct(Number(this.animation.currentTime)||0)}set time(e){const n=this.finishedTime!==null;this.manualStartTime=null,this.finishedTime=null,this.animation.currentTime=st(e),n&&this.animation.pause()}get speed(){return this.animation.playbackRate}set speed(e){e<0&&(this.finishedTime=null),this.animation.playbackRate=e}get state(){return this.finishedTime!==null?"finished":this.animation.playState}get startTime(){return this.manualStartTime??Number(this.animation.startTime)}set startTime(e){this.manualStartTime=this.animation.startTime=e}attachTimeline({timeline:e,rangeStart:n,rangeEnd:r,observe:s}){var i;return this.allowFlatten&&((i=this.animation.effect)==null||i.updateTiming({easing:"linear"})),this.animation.onfinish=null,e&&WI()?(this.animation.timeline=e,n&&(this.animation.rangeStart=n),r&&(this.animation.rangeEnd=r),ut):s(this)}}const Eg={anticipate:Qm,backInOut:Ym,circInOut:Jm};function KI(t){return t in Eg}function YI(t){typeof t.ease=="string"&&KI(t.ease)&&(t.ease=Eg[t.ease])}const Za=10;class QI extends Tg{constructor(e){YI(e),fg(e),super(e),e.startTime!==void 0&&e.autoplay!==!1&&(this.startTime=e.startTime),this.options=e}updateMotionValue(e){const{motionValue:n,onUpdate:r,onComplete:s,element:i,...o}=this.options;if(!n)return;if(e!==void 0){n.set(e);return}const c=new Eo({...o,autoplay:!1}),l=Math.max(Za,Ye.now()-this.startTime),u=Vt(0,Za,l-Za),h=c.sample(l).value,{name:f}=this.options;i&&f&&gg(i,f,h),n.setWithVelocity(c.sample(Math.max(0,l-u)).value,h,u),c.stop()}}const Rd=(t,e)=>e==="zIndex"?!1:!!(typeof t=="number"||Array.isArray(t)||typeof t=="string"&&(pt.test(t)||t==="0")&&!t.startsWith("url("));function XI(t){const e=t[0];if(t.length===1)return!0;for(let n=0;n<t.length;n++)if(t[n]!==e)return!0}function JI(t,e,n,r){const s=t[0];if(s===null)return!1;if(e==="display"||e==="visibility")return!0;const i=t[t.length-1],o=Rd(s,e),c=Rd(i,e);return!o||!c?!1:XI(t)||(n==="spring"||wg(n))&&r}function Bc(t){t.duration=0,t.type="keyframes"}const Ig=new Set(["opacity","clipPath","filter","transform"]),ZI=/^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;function eb(t){for(let e=0;e<t.length;e++)if(typeof t[e]=="string"&&ZI.test(t[e]))return!0;return!1}const tb=new Set(["color","backgroundColor","outlineColor","fill","stroke","borderColor","borderTopColor","borderRightColor","borderBottomColor","borderLeftColor"]),nb=zm(()=>Object.hasOwnProperty.call(Element.prototype,"animate"));function rb(t){var f;const{motionValue:e,name:n,repeatDelay:r,repeatType:s,damping:i,type:o,keyframes:c}=t;if(!(((f=e==null?void 0:e.owner)==null?void 0:f.current)instanceof HTMLElement))return!1;const{onUpdate:u,transformTemplate:h}=e.owner.getProps();return nb()&&n&&(Ig.has(n)||tb.has(n)&&eb(c))&&(n!=="transform"||!h)&&!u&&!r&&s!=="mirror"&&i!==0&&o!=="inertia"}const sb=40;class ib extends Gl{constructor({autoplay:e=!0,delay:n=0,type:r="keyframes",repeat:s=0,repeatDelay:i=0,repeatType:o="loop",keyframes:c,name:l,motionValue:u,element:h,...f}){var w;super(),this.stop=()=>{var R,I;this._animation&&(this._animation.stop(),(R=this.stopTimeline)==null||R.call(this)),(I=this.keyframeResolver)==null||I.cancel()},this.createdAt=Ye.now();const m={autoplay:e,delay:n,type:r,repeat:s,repeatDelay:i,repeatType:o,name:l,motionValue:u,element:h,...f},y=(h==null?void 0:h.KeyframeResolver)||Kl;this.keyframeResolver=new y(c,(R,I,P)=>this.onKeyframesResolved(R,I,m,!P),l,u,h),(w=this.keyframeResolver)==null||w.scheduleResolve()}onKeyframesResolved(e,n,r,s){var P,x;this.keyframeResolver=void 0;const{name:i,type:o,velocity:c,delay:l,isHandoff:u,onUpdate:h}=r;this.resolvedAt=Ye.now();let f=!0;JI(e,i,o,c)||(f=!1,(wn.instantAnimations||!l)&&(h==null||h(Jo(e,r,n))),e[0]=e[e.length-1],Bc(r),r.repeat=0);const y={startTime:s?this.resolvedAt?this.resolvedAt-this.createdAt>sb?this.resolvedAt:this.createdAt:this.createdAt:void 0,finalKeyframe:n,...r,keyframes:e},w=f&&!u&&rb(y),R=(x=(P=y.motionValue)==null?void 0:P.owner)==null?void 0:x.current;let I;if(w)try{I=new QI({...y,element:R})}catch{I=new Eo(y)}else I=new Eo(y);I.finished.then(()=>{this.notifyFinished()}).catch(ut),this.pendingTimeline&&(this.stopTimeline=I.attachTimeline(this.pendingTimeline),this.pendingTimeline=void 0),this._animation=I}get finished(){return this._animation?this.animation.finished:this._finished}then(e,n){return this.finished.finally(e).then(()=>{})}get animation(){var e;return this._animation||((e=this.keyframeResolver)==null||e.resume(),$I()),this._animation}get duration(){return this.animation.duration}get iterationDuration(){return this.animation.iterationDuration}get time(){return this.animation.time}set time(e){this.animation.time=e}get speed(){return this.animation.speed}get state(){return this.animation.state}set speed(e){this.animation.speed=e}get startTime(){return this.animation.startTime}attachTimeline(e){return this._animation?this.stopTimeline=this.animation.attachTimeline(e):this.pendingTimeline=e,()=>this.stop()}play(){this.animation.play()}pause(){this.animation.pause()}complete(){this.animation.complete()}cancel(){var e;this._animation&&this.animation.cancel(),(e=this.keyframeResolver)==null||e.cancel()}}function bg(t,e,n,r=0,s=1){const i=Array.from(t).sort((u,h)=>u.sortNodePosition(h)).indexOf(e),o=t.size,c=(o-1)*r;return typeof n=="function"?n(i,o):s===1?i*r:c-i*r}const ob=/^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;function ab(t){const e=ob.exec(t);if(!e)return[,];const[,n,r,s]=e;return[`--${n??r}`,s]}function Ag(t,e,n=1){const[r,s]=ab(t);if(!r)return;const i=window.getComputedStyle(e).getPropertyValue(r);if(i){const o=i.trim();return Bm(o)?parseFloat(o):o}return $l(s)?Ag(s,e,n+1):s}const cb={type:"spring",stiffness:500,damping:25,restSpeed:10},lb=t=>({type:"spring",stiffness:550,damping:t===0?2*Math.sqrt(550):30,restSpeed:10}),ub={type:"keyframes",duration:.8},hb={type:"keyframes",ease:[.25,.1,.35,1],duration:.3},db=(t,{keyframes:e})=>e.length>2?ub:qr.has(t)?t.startsWith("scale")?lb(e[1]):cb:hb;function Rg(t,e){if(t!=null&&t.inherit&&e){const{inherit:n,...r}=t;return{...e,...r}}return t}function Yl(t,e){const n=(t==null?void 0:t[e])??(t==null?void 0:t.default)??t;return n!==t?Rg(n,t):n}const fb=new Set(["when","delay","delayChildren","staggerChildren","staggerDirection","repeat","repeatType","repeatDelay","from","elapsed"]);function pb(t){for(const e in t)if(!fb.has(e))return!0;return!1}const Ql=(t,e,n,r={},s,i)=>o=>{const c=Yl(r,t)||{},l=c.delay||r.delay||0;let{elapsed:u=0}=r;u=u-st(l);const h={keyframes:Array.isArray(n)?n:[null,n],ease:"easeOut",velocity:e.getVelocity(),...c,delay:-u,onUpdate:m=>{e.set(m),c.onUpdate&&c.onUpdate(m)},onComplete:()=>{o(),c.onComplete&&c.onComplete()},name:t,motionValue:e,element:i?void 0:s};pb(c)||Object.assign(h,db(t,h)),h.duration&&(h.duration=st(h.duration)),h.repeatDelay&&(h.repeatDelay=st(h.repeatDelay)),h.from!==void 0&&(h.keyframes[0]=h.from);let f=!1;if((h.type===!1||h.duration===0&&!h.repeatDelay)&&(Bc(h),h.delay===0&&(f=!0)),(wn.instantAnimations||wn.skipAnimations||s!=null&&s.shouldSkipAnimations)&&(f=!0,Bc(h),h.delay=0),h.allowFlatten=!c.type&&!c.ease,f&&!i&&e.get()!==void 0){const m=Jo(h.keyframes,c);if(m!==void 0){ae.update(()=>{h.onUpdate(m),h.onComplete()});return}}return c.isSync?new Eo(h):new ib(h)};function Sd(t){const e=[{},{}];return t==null||t.values.forEach((n,r)=>{e[0][r]=n.get(),e[1][r]=n.getVelocity()}),e}function Xl(t,e,n,r){if(typeof e=="function"){const[s,i]=Sd(r);e=e(n!==void 0?n:t.custom,s,i)}if(typeof e=="string"&&(e=t.variants&&t.variants[e]),typeof e=="function"){const[s,i]=Sd(r);e=e(n!==void 0?n:t.custom,s,i)}return e}function Jn(t,e,n){const r=t.getProps();return Xl(r,e,n!==void 0?n:r.custom,t)}const Sg=new Set(["width","height","top","left","right","bottom",...zr]),Pd=30,mb=t=>!isNaN(parseFloat(t)),ks={current:void 0};class gb{constructor(e,n={}){this.canTrackVelocity=null,this.events={},this.updateAndNotify=r=>{var i;const s=Ye.now();if(this.updatedAt!==s&&this.setPrevFrameValue(),this.prev=this.current,this.setCurrent(r),this.current!==this.prev&&((i=this.events.change)==null||i.notify(this.current),this.dependents))for(const o of this.dependents)o.dirty()},this.hasAnimated=!1,this.setCurrent(e),this.owner=n.owner}setCurrent(e){this.current=e,this.updatedAt=Ye.now(),this.canTrackVelocity===null&&e!==void 0&&(this.canTrackVelocity=mb(this.current))}setPrevFrameValue(e=this.current){this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt}onChange(e){return this.on("change",e)}on(e,n){this.events[e]||(this.events[e]=new Ul);const r=this.events[e].add(n);return e==="change"?()=>{r(),ae.read(()=>{this.events.change.getSize()||this.stop()})}:r}clearListeners(){for(const e in this.events)this.events[e].clear()}attach(e,n){this.passiveEffect=e,this.stopPassiveEffect=n}set(e){this.passiveEffect?this.passiveEffect(e,this.updateAndNotify):this.updateAndNotify(e)}setWithVelocity(e,n,r){this.set(n),this.prev=void 0,this.prevFrameValue=e,this.prevUpdatedAt=this.updatedAt-r}jump(e,n=!0){this.updateAndNotify(e),this.prev=e,this.prevUpdatedAt=this.prevFrameValue=void 0,n&&this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}dirty(){var e;(e=this.events.change)==null||e.notify(this.current)}addDependent(e){this.dependents||(this.dependents=new Set),this.dependents.add(e)}removeDependent(e){this.dependents&&this.dependents.delete(e)}get(){return ks.current&&ks.current.push(this),this.current}getPrevious(){return this.prev}getVelocity(){const e=Ye.now();if(!this.canTrackVelocity||this.prevFrameValue===void 0||e-this.updatedAt>Pd)return 0;const n=Math.min(this.updatedAt-this.prevUpdatedAt,Pd);return qm(parseFloat(this.current)-parseFloat(this.prevFrameValue),n)}start(e){return this.stop(),new Promise(n=>{this.hasAnimated=!0,this.animation=e(n),this.events.animationStart&&this.events.animationStart.notify()}).then(()=>{this.events.animationComplete&&this.events.animationComplete.notify(),this.clearAnimation()})}stop(){this.animation&&(this.animation.stop(),this.events.animationCancel&&this.events.animationCancel.notify()),this.clearAnimation()}isAnimating(){return!!this.animation}clearAnimation(){delete this.animation}destroy(){var e,n;(e=this.dependents)==null||e.clear(),(n=this.events.destroy)==null||n.notify(),this.clearListeners(),this.stop(),this.stopPassiveEffect&&this.stopPassiveEffect()}}function tr(t,e){return new gb(t,e)}const jc=t=>Array.isArray(t);function yb(t,e,n){t.hasValue(e)?t.getValue(e).set(n):t.addValue(e,tr(n))}function _b(t){return jc(t)?t[t.length-1]||0:t}function vb(t,e){const n=Jn(t,e);let{transitionEnd:r={},transition:s={},...i}=n||{};i={...i,...r};for(const o in i){const c=_b(i[o]);yb(t,o,c)}}const Le=t=>!!(t&&t.getVelocity);function wb(t){return!!(Le(t)&&t.add)}function $c(t,e){const n=t.getValue("willChange");if(wb(n))return n.add(e);if(!n&&wn.WillChange){const r=new wn.WillChange("auto");t.addValue("willChange",r),r.add(e)}}function Jl(t){return t.replace(/([A-Z])/g,e=>`-${e.toLowerCase()}`)}const Tb="framerAppearId",Pg="data-"+Jl(Tb);function Cg(t){return t.props[Pg]}function Eb({protectedKeys:t,needsAnimating:e},n){const r=t.hasOwnProperty(n)&&e[n]!==!0;return e[n]=!1,r}function kg(t,e,{delay:n=0,transitionOverride:r,type:s}={}){let{transition:i,transitionEnd:o,...c}=e;const l=t.getDefaultTransition();i=i?Rg(i,l):l;const u=i==null?void 0:i.reduceMotion;r&&(i=r);const h=[],f=s&&t.animationState&&t.animationState.getState()[s];for(const m in c){const y=t.getValue(m,t.latestValues[m]??null),w=c[m];if(w===void 0||f&&Eb(f,m))continue;const R={delay:n,...Yl(i||{},m)},I=y.get();if(I!==void 0&&!y.isAnimating()&&!Array.isArray(w)&&w===I&&!R.velocity){ae.update(()=>y.set(w));continue}let P=!1;if(window.MotionHandoffAnimation){const L=Cg(t);if(L){const O=window.MotionHandoffAnimation(L,m,ae);O!==null&&(R.startTime=O,P=!0)}}$c(t,m);const x=u??t.shouldReduceMotion;y.start(Ql(m,y,w,x&&Sg.has(m)?{type:!1}:R,t,P));const V=y.animation;V&&h.push(V)}if(o){const m=()=>ae.update(()=>{o&&vb(t,o)});h.length?Promise.all(h).then(m):m()}return h}function zc(t,e,n={}){var l;const r=Jn(t,e,n.type==="exit"?(l=t.presenceContext)==null?void 0:l.custom:void 0);let{transition:s=t.getDefaultTransition()||{}}=r||{};n.transitionOverride&&(s=n.transitionOverride);const i=r?()=>Promise.all(kg(t,r,n)):()=>Promise.resolve(),o=t.variantChildren&&t.variantChildren.size?(u=0)=>{const{delayChildren:h=0,staggerChildren:f,staggerDirection:m}=s;return Ib(t,e,u,h,f,m,n)}:()=>Promise.resolve(),{when:c}=s;if(c){const[u,h]=c==="beforeChildren"?[i,o]:[o,i];return u().then(()=>h())}else return Promise.all([i(),o(n.delay)])}function Ib(t,e,n=0,r=0,s=0,i=1,o){const c=[];for(const l of t.variantChildren)l.notify("AnimationStart",e),c.push(zc(l,e,{...o,delay:n+(typeof r=="function"?0:r)+bg(t.variantChildren,l,r,s,i)}).then(()=>l.notify("AnimationComplete",e)));return Promise.all(c)}function bb(t,e,n={}){t.notify("AnimationStart",e);let r;if(Array.isArray(e)){const s=e.map(i=>zc(t,i,n));r=Promise.all(s)}else if(typeof e=="string")r=zc(t,e,n);else{const s=typeof e=="function"?Jn(t,e,n.custom):e;r=Promise.all(kg(t,s,n))}return r.then(()=>{t.notify("AnimationComplete",e)})}const Ab={test:t=>t==="auto",parse:t=>t},xg=t=>e=>e.test(t),Vg=[$r,$,St,an,J0,X0,Ab],Cd=t=>Vg.find(xg(t));function Rb(t){return typeof t=="number"?t===0:t!==null?t==="none"||t==="0"||$m(t):!0}const Sb=new Set(["brightness","contrast","saturate","opacity"]);function Pb(t){const[e,n]=t.slice(0,-1).split("(");if(e==="drop-shadow")return t;const[r]=n.match(zl)||[];if(!r)return t;const s=n.replace(r,"");let i=Sb.has(e)?1:0;return r!==n&&(i*=100),e+"("+i+s+")"}const Cb=/\b([a-z-]*)\(.*?\)/gu,qc={...pt,getAnimatableNone:t=>{const e=t.match(Cb);return e?e.map(Pb).join(" "):t}},Wc={...pt,getAnimatableNone:t=>{const e=pt.parse(t);return pt.createTransformer(t)(e.map(r=>typeof r=="number"?0:typeof r=="object"?{...r,alpha:1}:r))}},kd={...$r,transform:Math.round},kb={rotate:an,rotateX:an,rotateY:an,rotateZ:an,scale:Oi,scaleX:Oi,scaleY:Oi,scaleZ:Oi,skew:an,skewX:an,skewY:an,distance:$,translateX:$,translateY:$,translateZ:$,x:$,y:$,z:$,perspective:$,transformPerspective:$,opacity:$s,originX:gd,originY:gd,originZ:$},Zl={borderWidth:$,borderTopWidth:$,borderRightWidth:$,borderBottomWidth:$,borderLeftWidth:$,borderRadius:$,borderTopLeftRadius:$,borderTopRightRadius:$,borderBottomRightRadius:$,borderBottomLeftRadius:$,width:$,maxWidth:$,height:$,maxHeight:$,top:$,right:$,bottom:$,left:$,inset:$,insetBlock:$,insetBlockStart:$,insetBlockEnd:$,insetInline:$,insetInlineStart:$,insetInlineEnd:$,padding:$,paddingTop:$,paddingRight:$,paddingBottom:$,paddingLeft:$,paddingBlock:$,paddingBlockStart:$,paddingBlockEnd:$,paddingInline:$,paddingInlineStart:$,paddingInlineEnd:$,margin:$,marginTop:$,marginRight:$,marginBottom:$,marginLeft:$,marginBlock:$,marginBlockStart:$,marginBlockEnd:$,marginInline:$,marginInlineStart:$,marginInlineEnd:$,fontSize:$,backgroundPositionX:$,backgroundPositionY:$,...kb,zIndex:kd,fillOpacity:$s,strokeOpacity:$s,numOctaves:kd},xb={...Zl,color:Ae,backgroundColor:Ae,outlineColor:Ae,fill:Ae,stroke:Ae,borderColor:Ae,borderTopColor:Ae,borderRightColor:Ae,borderBottomColor:Ae,borderLeftColor:Ae,filter:qc,WebkitFilter:qc,mask:Wc,WebkitMask:Wc},Dg=t=>xb[t],Vb=new Set([qc,Wc]);function Mg(t,e){let n=Dg(t);return Vb.has(n)||(n=pt),n.getAnimatableNone?n.getAnimatableNone(e):void 0}const Db=new Set(["auto","none","0"]);function Mb(t,e,n){let r=0,s;for(;r<t.length&&!s;){const i=t[r];typeof i=="string"&&!Db.has(i)&&xr(i).values.length&&(s=t[r]),r++}if(s&&n)for(const i of e)t[i]=Mg(n,s)}class Nb extends Kl{constructor(e,n,r,s,i){super(e,n,r,s,i,!0)}readKeyframes(){const{unresolvedKeyframes:e,element:n,name:r}=this;if(!n||!n.current)return;super.readKeyframes();for(let h=0;h<e.length;h++){let f=e[h];if(typeof f=="string"&&(f=f.trim(),$l(f))){const m=Ag(f,n.current);m!==void 0&&(e[h]=m),h===e.length-1&&(this.finalKeyframe=f)}}if(this.resolveNoneKeyframes(),!Sg.has(r)||e.length!==2)return;const[s,i]=e,o=Cd(s),c=Cd(i),l=md(s),u=md(i);if(l!==u&&fn[r]){this.needsMeasurement=!0;return}if(o!==c)if(bd(o)&&bd(c))for(let h=0;h<e.length;h++){const f=e[h];typeof f=="string"&&(e[h]=parseFloat(f))}else fn[r]&&(this.needsMeasurement=!0)}resolveNoneKeyframes(){const{unresolvedKeyframes:e,name:n}=this,r=[];for(let s=0;s<e.length;s++)(e[s]===null||Rb(e[s]))&&r.push(s);r.length&&Mb(e,r,n)}measureInitialState(){const{element:e,unresolvedKeyframes:n,name:r}=this;if(!e||!e.current)return;r==="height"&&(this.suspendedScrollY=window.pageYOffset),this.measuredOrigin=fn[r](e.measureViewportBox(),window.getComputedStyle(e.current)),n[0]=this.measuredOrigin;const s=n[n.length-1];s!==void 0&&e.getValue(r,s).jump(s,!1)}measureEndState(){var c;const{element:e,name:n,unresolvedKeyframes:r}=this;if(!e||!e.current)return;const s=e.getValue(n);s&&s.jump(this.measuredOrigin,!1);const i=r.length-1,o=r[i];r[i]=fn[n](e.measureViewportBox(),window.getComputedStyle(e.current)),o!==null&&this.finalKeyframe===void 0&&(this.finalKeyframe=o),(c=this.removedTransforms)!=null&&c.length&&this.removedTransforms.forEach(([l,u])=>{e.getValue(l).set(u)}),this.resolveNoneKeyframes()}}function Ng(t,e,n){if(t==null)return[];if(t instanceof EventTarget)return[t];if(typeof t=="string"){let r=document;const s=(n==null?void 0:n[t])??r.querySelectorAll(t);return s?Array.from(s):[]}return Array.from(t).filter(r=>r!=null)}const Lg=(t,e)=>e&&typeof t=="number"?e.transform(t):t;function Zi(t){return jm(t)&&"offsetHeight"in t&&!("ownerSVGElement"in t)}const{schedule:eu}=tg(queueMicrotask,!1),dt={x:!1,y:!1};function Og(){return dt.x||dt.y}function Lb(t){return t==="x"||t==="y"?dt[t]?null:(dt[t]=!0,()=>{dt[t]=!1}):dt.x||dt.y?null:(dt.x=dt.y=!0,()=>{dt.x=dt.y=!1})}function Fg(t,e){const n=Ng(t),r=new AbortController,s={passive:!0,...e,signal:r.signal};return[n,s,()=>r.abort()]}function Ob(t){return!(t.pointerType==="touch"||Og())}function Fb(t,e,n={}){const[r,s,i]=Fg(t,n);return r.forEach(o=>{let c=!1,l=!1,u;const h=()=>{o.removeEventListener("pointerleave",w)},f=I=>{u&&(u(I),u=void 0),h()},m=I=>{c=!1,window.removeEventListener("pointerup",m),window.removeEventListener("pointercancel",m),l&&(l=!1,f(I))},y=()=>{c=!0,window.addEventListener("pointerup",m,s),window.addEventListener("pointercancel",m,s)},w=I=>{if(I.pointerType!=="touch"){if(c){l=!0;return}f(I)}},R=I=>{if(!Ob(I))return;l=!1;const P=e(o,I);typeof P=="function"&&(u=P,o.addEventListener("pointerleave",w,s))};o.addEventListener("pointerenter",R,s),o.addEventListener("pointerdown",y,s)}),i}const Ug=(t,e)=>e?t===e?!0:Ug(t,e.parentElement):!1,tu=t=>t.pointerType==="mouse"?typeof t.button!="number"||t.button<=0:t.isPrimary!==!1,Ub=new Set(["BUTTON","INPUT","SELECT","TEXTAREA","A"]);function Bb(t){return Ub.has(t.tagName)||t.isContentEditable===!0}const jb=new Set(["INPUT","SELECT","TEXTAREA"]);function $b(t){return jb.has(t.tagName)||t.isContentEditable===!0}const eo=new WeakSet;function xd(t){return e=>{e.key==="Enter"&&t(e)}}function ec(t,e){t.dispatchEvent(new PointerEvent("pointer"+e,{isPrimary:!0,bubbles:!0}))}const zb=(t,e)=>{const n=t.currentTarget;if(!n)return;const r=xd(()=>{if(eo.has(n))return;ec(n,"down");const s=xd(()=>{ec(n,"up")}),i=()=>ec(n,"cancel");n.addEventListener("keyup",s,e),n.addEventListener("blur",i,e)});n.addEventListener("keydown",r,e),n.addEventListener("blur",()=>n.removeEventListener("keydown",r),e)};function Vd(t){return tu(t)&&!Og()}const Dd=new WeakSet;function qb(t,e,n={}){const[r,s,i]=Fg(t,n),o=c=>{const l=c.currentTarget;if(!Vd(c)||Dd.has(c))return;eo.add(l),n.stopPropagation&&Dd.add(c);const u=e(l,c),h=(y,w)=>{window.removeEventListener("pointerup",f),window.removeEventListener("pointercancel",m),eo.has(l)&&eo.delete(l),Vd(y)&&typeof u=="function"&&u(y,{success:w})},f=y=>{h(y,l===window||l===document||n.useGlobalTarget||Ug(l,y.target))},m=y=>{h(y,!1)};window.addEventListener("pointerup",f,s),window.addEventListener("pointercancel",m,s)};return r.forEach(c=>{(n.useGlobalTarget?window:c).addEventListener("pointerdown",o,s),Zi(c)&&(c.addEventListener("focus",u=>zb(u,s)),!Bb(c)&&!c.hasAttribute("tabindex")&&(c.tabIndex=0))}),i}function nu(t){return jm(t)&&"ownerSVGElement"in t}const to=new WeakMap;let cn;const Bg=(t,e,n)=>(r,s)=>s&&s[0]?s[0][t+"Size"]:nu(r)&&"getBBox"in r?r.getBBox()[e]:r[n],Wb=Bg("inline","width","offsetWidth"),Hb=Bg("block","height","offsetHeight");function Gb({target:t,borderBoxSize:e}){var n;(n=to.get(t))==null||n.forEach(r=>{r(t,{get width(){return Wb(t,e)},get height(){return Hb(t,e)}})})}function Kb(t){t.forEach(Gb)}function Yb(){typeof ResizeObserver>"u"||(cn=new ResizeObserver(Kb))}function Qb(t,e){cn||Yb();const n=Ng(t);return n.forEach(r=>{let s=to.get(r);s||(s=new Set,to.set(r,s)),s.add(e),cn==null||cn.observe(r)}),()=>{n.forEach(r=>{const s=to.get(r);s==null||s.delete(e),s!=null&&s.size||cn==null||cn.unobserve(r)})}}const no=new Set;let br;function Xb(){br=()=>{const t={get width(){return window.innerWidth},get height(){return window.innerHeight}};no.forEach(e=>e(t))},window.addEventListener("resize",br)}function Jb(t){return no.add(t),br||Xb(),()=>{no.delete(t),!no.size&&typeof br=="function"&&(window.removeEventListener("resize",br),br=void 0)}}function Md(t,e){return typeof t=="function"?Jb(t):Qb(t,e)}function Zb(t){return nu(t)&&t.tagName==="svg"}function eA(...t){const e=!Array.isArray(t[0]),n=e?0:-1,r=t[0+n],s=t[1+n],i=t[2+n],o=t[3+n],c=dg(s,i,o);return e?c(r):c}const tA=[...Vg,Ae,pt],nA=t=>tA.find(xg(t)),Nd=()=>({translate:0,scale:1,origin:0,originPoint:0}),Ar=()=>({x:Nd(),y:Nd()}),Ld=()=>({min:0,max:0}),Ve=()=>({x:Ld(),y:Ld()}),rA=new WeakMap;function Zo(t){return t!==null&&typeof t=="object"&&typeof t.start=="function"}function zs(t){return typeof t=="string"||Array.isArray(t)}const ru=["animate","whileInView","whileFocus","whileHover","whileTap","whileDrag","exit"],su=["initial",...ru];function ea(t){return Zo(t.animate)||su.some(e=>zs(t[e]))}function jg(t){return!!(ea(t)||t.variants)}function sA(t,e,n){for(const r in e){const s=e[r],i=n[r];if(Le(s))t.addValue(r,s);else if(Le(i))t.addValue(r,tr(s,{owner:t}));else if(i!==s)if(t.hasValue(r)){const o=t.getValue(r);o.liveStyle===!0?o.jump(s):o.hasAnimated||o.set(s)}else{const o=t.getStaticValue(r);t.addValue(r,tr(o!==void 0?o:s,{owner:t}))}}for(const r in n)e[r]===void 0&&t.removeValue(r);return e}const Hc={current:null},$g={current:!1},iA=typeof window<"u";function oA(){if($g.current=!0,!!iA)if(window.matchMedia){const t=window.matchMedia("(prefers-reduced-motion)"),e=()=>Hc.current=t.matches;t.addEventListener("change",e),e()}else Hc.current=!1}const Od=["AnimationStart","AnimationComplete","Update","BeforeLayoutMeasure","LayoutMeasure","LayoutAnimationStart","LayoutAnimationComplete"];let Io={};function zg(t){Io=t}function aA(){return Io}class cA{scrapeMotionValuesFromProps(e,n,r){return{}}constructor({parent:e,props:n,presenceContext:r,reducedMotionConfig:s,skipAnimations:i,blockInitialAnimation:o,visualState:c},l={}){this.current=null,this.children=new Set,this.isVariantNode=!1,this.isControllingVariants=!1,this.shouldReduceMotion=null,this.shouldSkipAnimations=!1,this.values=new Map,this.KeyframeResolver=Kl,this.features={},this.valueSubscriptions=new Map,this.prevMotionValues={},this.hasBeenMounted=!1,this.events={},this.propEventSubscriptions={},this.notifyUpdate=()=>this.notify("Update",this.latestValues),this.render=()=>{this.current&&(this.triggerBuild(),this.renderInstance(this.current,this.renderState,this.props.style,this.projection))},this.renderScheduledAt=0,this.scheduleRender=()=>{const y=Ye.now();this.renderScheduledAt<y&&(this.renderScheduledAt=y,ae.render(this.render,!1,!0))};const{latestValues:u,renderState:h}=c;this.latestValues=u,this.baseTarget={...u},this.initialValues=n.initial?{...u}:{},this.renderState=h,this.parent=e,this.props=n,this.presenceContext=r,this.depth=e?e.depth+1:0,this.reducedMotionConfig=s,this.skipAnimationsConfig=i,this.options=l,this.blockInitialAnimation=!!o,this.isControllingVariants=ea(n),this.isVariantNode=jg(n),this.isVariantNode&&(this.variantChildren=new Set),this.manuallyAnimateOnMount=!!(e&&e.current);const{willChange:f,...m}=this.scrapeMotionValuesFromProps(n,{},this);for(const y in m){const w=m[y];u[y]!==void 0&&Le(w)&&w.set(u[y])}}mount(e){var n,r;if(this.hasBeenMounted)for(const s in this.initialValues)(n=this.values.get(s))==null||n.jump(this.initialValues[s]),this.latestValues[s]=this.initialValues[s];this.current=e,rA.set(e,this),this.projection&&!this.projection.instance&&this.projection.mount(e),this.parent&&this.isVariantNode&&!this.isControllingVariants&&(this.removeFromVariantTree=this.parent.addVariantChild(this)),this.values.forEach((s,i)=>this.bindToMotionValue(i,s)),this.reducedMotionConfig==="never"?this.shouldReduceMotion=!1:this.reducedMotionConfig==="always"?this.shouldReduceMotion=!0:($g.current||oA(),this.shouldReduceMotion=Hc.current),this.shouldSkipAnimations=this.skipAnimationsConfig??!1,(r=this.parent)==null||r.addChild(this),this.update(this.props,this.presenceContext),this.hasBeenMounted=!0}unmount(){var e;this.projection&&this.projection.unmount(),qt(this.notifyUpdate),qt(this.render),this.valueSubscriptions.forEach(n=>n()),this.valueSubscriptions.clear(),this.removeFromVariantTree&&this.removeFromVariantTree(),(e=this.parent)==null||e.removeChild(this);for(const n in this.events)this.events[n].clear();for(const n in this.features){const r=this.features[n];r&&(r.unmount(),r.isMounted=!1)}this.current=null}addChild(e){this.children.add(e),this.enteringChildren??(this.enteringChildren=new Set),this.enteringChildren.add(e)}removeChild(e){this.children.delete(e),this.enteringChildren&&this.enteringChildren.delete(e)}bindToMotionValue(e,n){if(this.valueSubscriptions.has(e)&&this.valueSubscriptions.get(e)(),n.accelerate&&Ig.has(e)&&this.current instanceof HTMLElement){const{factory:o,keyframes:c,times:l,ease:u,duration:h}=n.accelerate,f=new Tg({element:this.current,name:e,keyframes:c,times:l,ease:u,duration:st(h)}),m=o(f);this.valueSubscriptions.set(e,()=>{m(),f.cancel()});return}const r=qr.has(e);r&&this.onBindTransform&&this.onBindTransform();const s=n.on("change",o=>{this.latestValues[e]=o,this.props.onUpdate&&ae.preRender(this.notifyUpdate),r&&this.projection&&(this.projection.isTransformDirty=!0),this.scheduleRender()});let i;typeof window<"u"&&window.MotionCheckAppearSync&&(i=window.MotionCheckAppearSync(this,e,n)),this.valueSubscriptions.set(e,()=>{s(),i&&i(),n.owner&&n.stop()})}sortNodePosition(e){return!this.current||!this.sortInstanceNodePosition||this.type!==e.type?0:this.sortInstanceNodePosition(this.current,e.current)}updateFeatures(){let e="animation";for(e in Io){const n=Io[e];if(!n)continue;const{isEnabled:r,Feature:s}=n;if(!this.features[e]&&s&&r(this.props)&&(this.features[e]=new s(this)),this.features[e]){const i=this.features[e];i.isMounted?i.update():(i.mount(),i.isMounted=!0)}}}triggerBuild(){this.build(this.renderState,this.latestValues,this.props)}measureViewportBox(){return this.current?this.measureInstanceViewportBox(this.current,this.props):Ve()}getStaticValue(e){return this.latestValues[e]}setStaticValue(e,n){this.latestValues[e]=n}update(e,n){(e.transformTemplate||this.props.transformTemplate)&&this.scheduleRender(),this.prevProps=this.props,this.props=e,this.prevPresenceContext=this.presenceContext,this.presenceContext=n;for(let r=0;r<Od.length;r++){const s=Od[r];this.propEventSubscriptions[s]&&(this.propEventSubscriptions[s](),delete this.propEventSubscriptions[s]);const i="on"+s,o=e[i];o&&(this.propEventSubscriptions[s]=this.on(s,o))}this.prevMotionValues=sA(this,this.scrapeMotionValuesFromProps(e,this.prevProps||{},this),this.prevMotionValues),this.handleChildMotionValue&&this.handleChildMotionValue()}getProps(){return this.props}getVariant(e){return this.props.variants?this.props.variants[e]:void 0}getDefaultTransition(){return this.props.transition}getTransformPagePoint(){return this.props.transformPagePoint}getClosestVariantNode(){return this.isVariantNode?this:this.parent?this.parent.getClosestVariantNode():void 0}addVariantChild(e){const n=this.getClosestVariantNode();if(n)return n.variantChildren&&n.variantChildren.add(e),()=>n.variantChildren.delete(e)}addValue(e,n){const r=this.values.get(e);n!==r&&(r&&this.removeValue(e),this.bindToMotionValue(e,n),this.values.set(e,n),this.latestValues[e]=n.get())}removeValue(e){this.values.delete(e);const n=this.valueSubscriptions.get(e);n&&(n(),this.valueSubscriptions.delete(e)),delete this.latestValues[e],this.removeValueFromRenderState(e,this.renderState)}hasValue(e){return this.values.has(e)}getValue(e,n){if(this.props.values&&this.props.values[e])return this.props.values[e];let r=this.values.get(e);return r===void 0&&n!==void 0&&(r=tr(n===null?void 0:n,{owner:this}),this.addValue(e,r)),r}readValue(e,n){let r=this.latestValues[e]!==void 0||!this.current?this.latestValues[e]:this.getBaseTargetFromProps(this.props,e)??this.readValueFromInstance(this.current,e,this.options);return r!=null&&(typeof r=="string"&&(Bm(r)||$m(r))?r=parseFloat(r):!nA(r)&&pt.test(n)&&(r=Mg(e,n)),this.setBaseTarget(e,Le(r)?r.get():r)),Le(r)?r.get():r}setBaseTarget(e,n){this.baseTarget[e]=n}getBaseTarget(e){var i;const{initial:n}=this.props;let r;if(typeof n=="string"||typeof n=="object"){const o=Xl(this.props,n,(i=this.presenceContext)==null?void 0:i.custom);o&&(r=o[e])}if(n&&r!==void 0)return r;const s=this.getBaseTargetFromProps(this.props,e);return s!==void 0&&!Le(s)?s:this.initialValues[e]!==void 0&&r===void 0?void 0:this.baseTarget[e]}on(e,n){return this.events[e]||(this.events[e]=new Ul),this.events[e].add(n)}notify(e,...n){this.events[e]&&this.events[e].notify(...n)}scheduleRenderMicrotask(){eu.render(this.render)}}class qg extends cA{constructor(){super(...arguments),this.KeyframeResolver=Nb}sortInstanceNodePosition(e,n){return e.compareDocumentPosition(n)&2?1:-1}getBaseTargetFromProps(e,n){const r=e.style;return r?r[n]:void 0}removeValueFromRenderState(e,{vars:n,style:r}){delete n[e],delete r[e]}handleChildMotionValue(){this.childSubscription&&(this.childSubscription(),delete this.childSubscription);const{children:e}=this.props;Le(e)&&(this.childSubscription=e.on("change",n=>{this.current&&(this.current.textContent=`${n}`)}))}}class Cn{constructor(e){this.isMounted=!1,this.node=e}update(){}}function Wg({top:t,left:e,right:n,bottom:r}){return{x:{min:e,max:n},y:{min:t,max:r}}}function lA({x:t,y:e}){return{top:e.min,right:t.max,bottom:e.max,left:t.min}}function uA(t,e){if(!e)return t;const n=e({x:t.left,y:t.top}),r=e({x:t.right,y:t.bottom});return{top:n.y,left:n.x,bottom:r.y,right:r.x}}function tc(t){return t===void 0||t===1}function Gc({scale:t,scaleX:e,scaleY:n}){return!tc(t)||!tc(e)||!tc(n)}function Wn(t){return Gc(t)||Hg(t)||t.z||t.rotate||t.rotateX||t.rotateY||t.skewX||t.skewY}function Hg(t){return Fd(t.x)||Fd(t.y)}function Fd(t){return t&&t!=="0%"}function bo(t,e,n){const r=t-n,s=e*r;return n+s}function Ud(t,e,n,r,s){return s!==void 0&&(t=bo(t,s,r)),bo(t,n,r)+e}function Kc(t,e=0,n=1,r,s){t.min=Ud(t.min,e,n,r,s),t.max=Ud(t.max,e,n,r,s)}function Gg(t,{x:e,y:n}){Kc(t.x,e.translate,e.scale,e.originPoint),Kc(t.y,n.translate,n.scale,n.originPoint)}const Bd=.999999999999,jd=1.0000000000001;function hA(t,e,n,r=!1){var c;const s=n.length;if(!s)return;e.x=e.y=1;let i,o;for(let l=0;l<s;l++){i=n[l],o=i.projectionDelta;const{visualElement:u}=i.options;u&&u.props.style&&u.props.style.display==="contents"||(r&&i.options.layoutScroll&&i.scroll&&i!==i.root&&(At(t.x,-i.scroll.offset.x),At(t.y,-i.scroll.offset.y)),o&&(e.x*=o.x.scale,e.y*=o.y.scale,Gg(t,o)),r&&Wn(i.latestValues)&&ro(t,i.latestValues,(c=i.layout)==null?void 0:c.layoutBox))}e.x<jd&&e.x>Bd&&(e.x=1),e.y<jd&&e.y>Bd&&(e.y=1)}function At(t,e){t.min+=e,t.max+=e}function $d(t,e,n,r,s=.5){const i=he(t.min,t.max,s);Kc(t,e,n,i,r)}function zd(t,e){return typeof t=="string"?parseFloat(t)/100*(e.max-e.min):t}function ro(t,e,n){const r=n??t;$d(t.x,zd(e.x,r.x),e.scaleX,e.scale,e.originX),$d(t.y,zd(e.y,r.y),e.scaleY,e.scale,e.originY)}function Kg(t,e){return Wg(uA(t.getBoundingClientRect(),e))}function dA(t,e,n){const r=Kg(t,n),{scroll:s}=e;return s&&(At(r.x,s.offset.x),At(r.y,s.offset.y)),r}const fA={x:"translateX",y:"translateY",z:"translateZ",transformPerspective:"perspective"},pA=zr.length;function mA(t,e,n){let r="",s=!0;for(let i=0;i<pA;i++){const o=zr[i],c=t[o];if(c===void 0)continue;let l=!0;if(typeof c=="number")l=c===(o.startsWith("scale")?1:0);else{const u=parseFloat(c);l=o.startsWith("scale")?u===1:u===0}if(!l||n){const u=Lg(c,Zl[o]);if(!l){s=!1;const h=fA[o]||o;r+=`${h}(${u}) `}n&&(e[o]=u)}}return r=r.trim(),n?r=n(e,s?"":r):s&&(r="none"),r}function iu(t,e,n){const{style:r,vars:s,transformOrigin:i}=t;let o=!1,c=!1;for(const l in e){const u=e[l];if(qr.has(l)){o=!0;continue}else if(rg(l)){s[l]=u;continue}else{const h=Lg(u,Zl[l]);l.startsWith("origin")?(c=!0,i[l]=h):r[l]=h}}if(e.transform||(o||n?r.transform=mA(e,t.transform,n):r.transform&&(r.transform="none")),c){const{originX:l="50%",originY:u="50%",originZ:h=0}=i;r.transformOrigin=`${l} ${u} ${h}`}}function Yg(t,{style:e,vars:n},r,s){const i=t.style;let o;for(o in e)i[o]=e[o];s==null||s.applyProjectionStyles(i,r);for(o in n)i.setProperty(o,n[o])}function qd(t,e){return e.max===e.min?0:t/(e.max-e.min)*100}const _s={correct:(t,e)=>{if(!e.target)return t;if(typeof t=="string")if($.test(t))t=parseFloat(t);else return t;const n=qd(t,e.target.x),r=qd(t,e.target.y);return`${n}% ${r}%`}},gA={correct:(t,{treeScale:e,projectionDelta:n})=>{const r=t,s=pt.parse(t);if(s.length>5)return r;const i=pt.createTransformer(t),o=typeof s[0]!="number"?1:0,c=n.x.scale*e.x,l=n.y.scale*e.y;s[0+o]/=c,s[1+o]/=l;const u=he(c,l,.5);return typeof s[2+o]=="number"&&(s[2+o]/=u),typeof s[3+o]=="number"&&(s[3+o]/=u),i(s)}},Yc={borderRadius:{..._s,applyTo:["borderTopLeftRadius","borderTopRightRadius","borderBottomLeftRadius","borderBottomRightRadius"]},borderTopLeftRadius:_s,borderTopRightRadius:_s,borderBottomLeftRadius:_s,borderBottomRightRadius:_s,boxShadow:gA};function Qg(t,{layout:e,layoutId:n}){return qr.has(t)||t.startsWith("origin")||(e||n!==void 0)&&(!!Yc[t]||t==="opacity")}function ou(t,e,n){var o;const r=t.style,s=e==null?void 0:e.style,i={};if(!r)return i;for(const c in r)(Le(r[c])||s&&Le(s[c])||Qg(c,t)||((o=n==null?void 0:n.getValue(c))==null?void 0:o.liveStyle)!==void 0)&&(i[c]=r[c]);return i}function yA(t){return window.getComputedStyle(t)}class _A extends qg{constructor(){super(...arguments),this.type="html",this.renderInstance=Yg}readValueFromInstance(e,n){var r;if(qr.has(n))return(r=this.projection)!=null&&r.isProjecting?Nc(n):OI(e,n);{const s=yA(e),i=(rg(n)?s.getPropertyValue(n):s[n])||0;return typeof i=="string"?i.trim():i}}measureInstanceViewportBox(e,{transformPagePoint:n}){return Kg(e,n)}build(e,n,r){iu(e,n,r.transformTemplate)}scrapeMotionValuesFromProps(e,n,r){return ou(e,n,r)}}const vA={offset:"stroke-dashoffset",array:"stroke-dasharray"},wA={offset:"strokeDashoffset",array:"strokeDasharray"};function TA(t,e,n=1,r=0,s=!0){t.pathLength=1;const i=s?vA:wA;t[i.offset]=`${-r}`,t[i.array]=`${e} ${n}`}const EA=["offsetDistance","offsetPath","offsetRotate","offsetAnchor"];function Xg(t,{attrX:e,attrY:n,attrScale:r,pathLength:s,pathSpacing:i=1,pathOffset:o=0,...c},l,u,h){if(iu(t,c,u),l){t.style.viewBox&&(t.attrs.viewBox=t.style.viewBox);return}t.attrs=t.style,t.style={};const{attrs:f,style:m}=t;f.transform&&(m.transform=f.transform,delete f.transform),(m.transform||f.transformOrigin)&&(m.transformOrigin=f.transformOrigin??"50% 50%",delete f.transformOrigin),m.transform&&(m.transformBox=(h==null?void 0:h.transformBox)??"fill-box",delete f.transformBox);for(const y of EA)f[y]!==void 0&&(m[y]=f[y],delete f[y]);e!==void 0&&(f.x=e),n!==void 0&&(f.y=n),r!==void 0&&(f.scale=r),s!==void 0&&TA(f,s,i,o,!1)}const Jg=new Set(["baseFrequency","diffuseConstant","kernelMatrix","kernelUnitLength","keySplines","keyTimes","limitingConeAngle","markerHeight","markerWidth","numOctaves","targetX","targetY","surfaceScale","specularConstant","specularExponent","stdDeviation","tableValues","viewBox","gradientTransform","pathLength","startOffset","textLength","lengthAdjust"]),Zg=t=>typeof t=="string"&&t.toLowerCase()==="svg";function IA(t,e,n,r){Yg(t,e,void 0,r);for(const s in e.attrs)t.setAttribute(Jg.has(s)?s:Jl(s),e.attrs[s])}function ey(t,e,n){const r=ou(t,e,n);for(const s in t)if(Le(t[s])||Le(e[s])){const i=zr.indexOf(s)!==-1?"attr"+s.charAt(0).toUpperCase()+s.substring(1):s;r[i]=t[s]}return r}class bA extends qg{constructor(){super(...arguments),this.type="svg",this.isSVGTag=!1,this.measureInstanceViewportBox=Ve}getBaseTargetFromProps(e,n){return e[n]}readValueFromInstance(e,n){if(qr.has(n)){const r=Dg(n);return r&&r.default||0}return n=Jg.has(n)?n:Jl(n),e.getAttribute(n)}scrapeMotionValuesFromProps(e,n,r){return ey(e,n,r)}build(e,n,r){Xg(e,n,this.isSVGTag,r.transformTemplate,r.style)}renderInstance(e,n,r,s){IA(e,n,r,s)}mount(e){this.isSVGTag=Zg(e.tagName),super.mount(e)}}const AA=su.length;function ty(t){if(!t)return;if(!t.isControllingVariants){const n=t.parent?ty(t.parent)||{}:{};return t.props.initial!==void 0&&(n.initial=t.props.initial),n}const e={};for(let n=0;n<AA;n++){const r=su[n],s=t.props[r];(zs(s)||s===!1)&&(e[r]=s)}return e}function ny(t,e){if(!Array.isArray(e))return!1;const n=e.length;if(n!==t.length)return!1;for(let r=0;r<n;r++)if(e[r]!==t[r])return!1;return!0}const RA=[...ru].reverse(),SA=ru.length;function PA(t){return e=>Promise.all(e.map(({animation:n,options:r})=>bb(t,n,r)))}function CA(t){let e=PA(t),n=Wd(),r=!0,s=!1;const i=u=>(h,f)=>{var y;const m=Jn(t,f,u==="exit"?(y=t.presenceContext)==null?void 0:y.custom:void 0);if(m){const{transition:w,transitionEnd:R,...I}=m;h={...h,...I,...R}}return h};function o(u){e=u(t)}function c(u){const{props:h}=t,f=ty(t.parent)||{},m=[],y=new Set;let w={},R=1/0;for(let P=0;P<SA;P++){const x=RA[P],V=n[x],L=h[x]!==void 0?h[x]:f[x],O=zs(L),z=x===u?V.isActive:null;z===!1&&(R=P);let b=L===f[x]&&L!==h[x]&&O;if(b&&(r||s)&&t.manuallyAnimateOnMount&&(b=!1),V.protectedKeys={...w},!V.isActive&&z===null||!L&&!V.prevProp||Zo(L)||typeof L=="boolean")continue;if(x==="exit"&&V.isActive&&z!==!0){V.prevResolvedValues&&(w={...w,...V.prevResolvedValues});continue}const g=kA(V.prevProp,L);let v=g||x===u&&V.isActive&&!b&&O||P>R&&O,E=!1;const A=Array.isArray(L)?L:[L];let C=A.reduce(i(x),{});z===!1&&(C={});const{prevResolvedValues:T={}}=V,ie={...T,...C},se=le=>{v=!0,y.has(le)&&(E=!0,y.delete(le)),V.needsAnimating[le]=!0;const Te=t.getValue(le);Te&&(Te.liveStyle=!1)};for(const le in ie){const Te=C[le],H=T[le];if(w.hasOwnProperty(le))continue;let ot=!1;jc(Te)&&jc(H)?ot=!ny(Te,H):ot=Te!==H,ot?Te!=null?se(le):y.add(le):Te!==void 0&&y.has(le)?se(le):V.protectedKeys[le]=!0}V.prevProp=L,V.prevResolvedValues=C,V.isActive&&(w={...w,...C}),(r||s)&&t.blockInitialAnimation&&(v=!1);const pe=b&&g;v&&(!pe||E)&&m.push(...A.map(le=>{const Te={type:x};if(typeof le=="string"&&(r||s)&&!pe&&t.manuallyAnimateOnMount&&t.parent){const{parent:H}=t,ot=Jn(H,le);if(H.enteringChildren&&ot){const{delayChildren:Mn}=ot.transition||{};Te.delay=bg(H.enteringChildren,t,Mn)}}return{animation:le,options:Te}}))}if(y.size){const P={};if(typeof h.initial!="boolean"){const x=Jn(t,Array.isArray(h.initial)?h.initial[0]:h.initial);x&&x.transition&&(P.transition=x.transition)}y.forEach(x=>{const V=t.getBaseTarget(x),L=t.getValue(x);L&&(L.liveStyle=!0),P[x]=V??null}),m.push({animation:P})}let I=!!m.length;return r&&(h.initial===!1||h.initial===h.animate)&&!t.manuallyAnimateOnMount&&(I=!1),r=!1,s=!1,I?e(m):Promise.resolve()}function l(u,h){var m;if(n[u].isActive===h)return Promise.resolve();(m=t.variantChildren)==null||m.forEach(y=>{var w;return(w=y.animationState)==null?void 0:w.setActive(u,h)}),n[u].isActive=h;const f=c(u);for(const y in n)n[y].protectedKeys={};return f}return{animateChanges:c,setActive:l,setAnimateFunction:o,getState:()=>n,reset:()=>{n=Wd(),s=!0}}}function kA(t,e){return typeof e=="string"?e!==t:Array.isArray(e)?!ny(e,t):!1}function zn(t=!1){return{isActive:t,protectedKeys:{},needsAnimating:{},prevResolvedValues:{}}}function Wd(){return{animate:zn(!0),whileInView:zn(),whileHover:zn(),whileTap:zn(),whileDrag:zn(),whileFocus:zn(),exit:zn()}}function Qc(t,e){t.min=e.min,t.max=e.max}function ht(t,e){Qc(t.x,e.x),Qc(t.y,e.y)}function Hd(t,e){t.translate=e.translate,t.scale=e.scale,t.originPoint=e.originPoint,t.origin=e.origin}const ry=1e-4,xA=1-ry,VA=1+ry,sy=.01,DA=0-sy,MA=0+sy;function Qe(t){return t.max-t.min}function NA(t,e,n){return Math.abs(t-e)<=n}function Gd(t,e,n,r=.5){t.origin=r,t.originPoint=he(e.min,e.max,t.origin),t.scale=Qe(n)/Qe(e),t.translate=he(n.min,n.max,t.origin)-t.originPoint,(t.scale>=xA&&t.scale<=VA||isNaN(t.scale))&&(t.scale=1),(t.translate>=DA&&t.translate<=MA||isNaN(t.translate))&&(t.translate=0)}function xs(t,e,n,r){Gd(t.x,e.x,n.x,r?r.originX:void 0),Gd(t.y,e.y,n.y,r?r.originY:void 0)}function Kd(t,e,n,r=0){const s=r?he(n.min,n.max,r):n.min;t.min=s+e.min,t.max=t.min+Qe(e)}function LA(t,e,n,r){Kd(t.x,e.x,n.x,r==null?void 0:r.x),Kd(t.y,e.y,n.y,r==null?void 0:r.y)}function Yd(t,e,n,r=0){const s=r?he(n.min,n.max,r):n.min;t.min=e.min-s,t.max=t.min+Qe(e)}function Ao(t,e,n,r){Yd(t.x,e.x,n.x,r==null?void 0:r.x),Yd(t.y,e.y,n.y,r==null?void 0:r.y)}function Qd(t,e,n,r,s){return t-=e,t=bo(t,1/n,r),s!==void 0&&(t=bo(t,1/s,r)),t}function OA(t,e=0,n=1,r=.5,s,i=t,o=t){if(St.test(e)&&(e=parseFloat(e),e=he(o.min,o.max,e/100)-o.min),typeof e!="number")return;let c=he(i.min,i.max,r);t===i&&(c-=e),t.min=Qd(t.min,e,n,c,s),t.max=Qd(t.max,e,n,c,s)}function Xd(t,e,[n,r,s],i,o){OA(t,e[n],e[r],e[s],e.scale,i,o)}const FA=["x","scaleX","originX"],UA=["y","scaleY","originY"];function Jd(t,e,n,r){Xd(t.x,e,FA,n?n.x:void 0,r?r.x:void 0),Xd(t.y,e,UA,n?n.y:void 0,r?r.y:void 0)}function Zd(t){return t.translate===0&&t.scale===1}function iy(t){return Zd(t.x)&&Zd(t.y)}function ef(t,e){return t.min===e.min&&t.max===e.max}function BA(t,e){return ef(t.x,e.x)&&ef(t.y,e.y)}function tf(t,e){return Math.round(t.min)===Math.round(e.min)&&Math.round(t.max)===Math.round(e.max)}function oy(t,e){return tf(t.x,e.x)&&tf(t.y,e.y)}function nf(t){return Qe(t.x)/Qe(t.y)}function rf(t,e){return t.translate===e.translate&&t.scale===e.scale&&t.originPoint===e.originPoint}function It(t){return[t("x"),t("y")]}function jA(t,e,n){let r="";const s=t.x.translate/e.x,i=t.y.translate/e.y,o=(n==null?void 0:n.z)||0;if((s||i||o)&&(r=`translate3d(${s}px, ${i}px, ${o}px) `),(e.x!==1||e.y!==1)&&(r+=`scale(${1/e.x}, ${1/e.y}) `),n){const{transformPerspective:u,rotate:h,rotateX:f,rotateY:m,skewX:y,skewY:w}=n;u&&(r=`perspective(${u}px) ${r}`),h&&(r+=`rotate(${h}deg) `),f&&(r+=`rotateX(${f}deg) `),m&&(r+=`rotateY(${m}deg) `),y&&(r+=`skewX(${y}deg) `),w&&(r+=`skewY(${w}deg) `)}const c=t.x.scale*e.x,l=t.y.scale*e.y;return(c!==1||l!==1)&&(r+=`scale(${c}, ${l})`),r||"none"}const ay=["borderTopLeftRadius","borderTopRightRadius","borderBottomLeftRadius","borderBottomRightRadius"],$A=ay.length,sf=t=>typeof t=="string"?parseFloat(t):t,of=t=>typeof t=="number"||$.test(t);function zA(t,e,n,r,s,i){s?(t.opacity=he(0,n.opacity??1,qA(r)),t.opacityExit=he(e.opacity??1,0,WA(r))):i&&(t.opacity=he(e.opacity??1,n.opacity??1,r));for(let o=0;o<$A;o++){const c=ay[o];let l=af(e,c),u=af(n,c);if(l===void 0&&u===void 0)continue;l||(l=0),u||(u=0),l===0||u===0||of(l)===of(u)?(t[c]=Math.max(he(sf(l),sf(u),r),0),(St.test(u)||St.test(l))&&(t[c]+="%")):t[c]=u}(e.rotate||n.rotate)&&(t.rotate=he(e.rotate||0,n.rotate||0,r))}function af(t,e){return t[e]!==void 0?t[e]:t.borderRadius}const qA=cy(0,.5,Xm),WA=cy(.5,.95,ut);function cy(t,e,n){return r=>r<t?0:r>e?1:n(js(t,e,r))}function HA(t,e,n){const r=Le(t)?t:tr(t);return r.start(Ql("",r,e,n)),r.animation}function qs(t,e,n,r={passive:!0}){return t.addEventListener(e,n,r),()=>t.removeEventListener(e,n)}const GA=(t,e)=>t.depth-e.depth;class KA{constructor(){this.children=[],this.isDirty=!1}add(e){Ol(this.children,e),this.isDirty=!0}remove(e){_o(this.children,e),this.isDirty=!0}forEach(e){this.isDirty&&this.children.sort(GA),this.isDirty=!1,this.children.forEach(e)}}function YA(t,e){const n=Ye.now(),r=({timestamp:s})=>{const i=s-n;i>=e&&(qt(r),t(i-e))};return ae.setup(r,!0),()=>qt(r)}function so(t){return Le(t)?t.get():t}class QA{constructor(){this.members=[]}add(e){Ol(this.members,e);for(let n=this.members.length-1;n>=0;n--){const r=this.members[n];if(r===e||r===this.lead||r===this.prevLead)continue;const s=r.instance;(!s||s.isConnected===!1)&&!r.snapshot&&(_o(this.members,r),r.unmount())}e.scheduleRender()}remove(e){if(_o(this.members,e),e===this.prevLead&&(this.prevLead=void 0),e===this.lead){const n=this.members[this.members.length-1];n&&this.promote(n)}}relegate(e){var n;for(let r=this.members.indexOf(e)-1;r>=0;r--){const s=this.members[r];if(s.isPresent!==!1&&((n=s.instance)==null?void 0:n.isConnected)!==!1)return this.promote(s),!0}return!1}promote(e,n){var s;const r=this.lead;if(e!==r&&(this.prevLead=r,this.lead=e,e.show(),r)){r.updateSnapshot(),e.scheduleRender();const{layoutDependency:i}=r.options,{layoutDependency:o}=e.options;(i===void 0||i!==o)&&(e.resumeFrom=r,n&&(r.preserveOpacity=!0),r.snapshot&&(e.snapshot=r.snapshot,e.snapshot.latestValues=r.animationValues||r.latestValues),(s=e.root)!=null&&s.isUpdating&&(e.isLayoutDirty=!0)),e.options.crossfade===!1&&r.hide()}}exitAnimationComplete(){this.members.forEach(e=>{var n,r,s,i,o;(r=(n=e.options).onExitComplete)==null||r.call(n),(o=(s=e.resumingFrom)==null?void 0:(i=s.options).onExitComplete)==null||o.call(i)})}scheduleRender(){this.members.forEach(e=>e.instance&&e.scheduleRender(!1))}removeLeadSnapshot(){var e;(e=this.lead)!=null&&e.snapshot&&(this.lead.snapshot=void 0)}}const io={hasAnimatedSinceResize:!0,hasEverUpdated:!1},nc=["","X","Y","Z"],XA=1e3;let JA=0;function rc(t,e,n,r){const{latestValues:s}=e;s[t]&&(n[t]=s[t],e.setStaticValue(t,0),r&&(r[t]=0))}function ly(t){if(t.hasCheckedOptimisedAppear=!0,t.root===t)return;const{visualElement:e}=t.options;if(!e)return;const n=Cg(e);if(window.MotionHasOptimisedAnimation(n,"transform")){const{layout:s,layoutId:i}=t.options;window.MotionCancelOptimisedAnimation(n,"transform",ae,!(s||i))}const{parent:r}=t;r&&!r.hasCheckedOptimisedAppear&&ly(r)}function uy({attachResizeListener:t,defaultParent:e,measureScroll:n,checkIsScrollRoot:r,resetTransform:s}){return class{constructor(o={},c=e==null?void 0:e()){this.id=JA++,this.animationId=0,this.animationCommitId=0,this.children=new Set,this.options={},this.isTreeAnimating=!1,this.isAnimationBlocked=!1,this.isLayoutDirty=!1,this.isProjectionDirty=!1,this.isSharedProjectionDirty=!1,this.isTransformDirty=!1,this.updateManuallyBlocked=!1,this.updateBlockedByResize=!1,this.isUpdating=!1,this.isSVG=!1,this.needsReset=!1,this.shouldResetTransform=!1,this.hasCheckedOptimisedAppear=!1,this.treeScale={x:1,y:1},this.eventHandlers=new Map,this.hasTreeAnimated=!1,this.layoutVersion=0,this.updateScheduled=!1,this.scheduleUpdate=()=>this.update(),this.projectionUpdateScheduled=!1,this.checkUpdateFailed=()=>{this.isUpdating&&(this.isUpdating=!1,this.clearAllSnapshots())},this.updateProjection=()=>{this.projectionUpdateScheduled=!1,this.nodes.forEach(tR),this.nodes.forEach(aR),this.nodes.forEach(cR),this.nodes.forEach(nR)},this.resolvedRelativeTargetAt=0,this.linkedParentVersion=0,this.hasProjected=!1,this.isVisible=!0,this.animationProgress=0,this.sharedNodes=new Map,this.latestValues=o,this.root=c?c.root||c:this,this.path=c?[...c.path,c]:[],this.parent=c,this.depth=c?c.depth+1:0;for(let l=0;l<this.path.length;l++)this.path[l].shouldResetTransform=!0;this.root===this&&(this.nodes=new KA)}addEventListener(o,c){return this.eventHandlers.has(o)||this.eventHandlers.set(o,new Ul),this.eventHandlers.get(o).add(c)}notifyListeners(o,...c){const l=this.eventHandlers.get(o);l&&l.notify(...c)}hasListeners(o){return this.eventHandlers.has(o)}mount(o){if(this.instance)return;this.isSVG=nu(o)&&!Zb(o),this.instance=o;const{layoutId:c,layout:l,visualElement:u}=this.options;if(u&&!u.current&&u.mount(o),this.root.nodes.add(this),this.parent&&this.parent.children.add(this),this.root.hasTreeAnimated&&(l||c)&&(this.isLayoutDirty=!0),t){let h,f=0;const m=()=>this.root.updateBlockedByResize=!1;ae.read(()=>{f=window.innerWidth}),t(o,()=>{const y=window.innerWidth;y!==f&&(f=y,this.root.updateBlockedByResize=!0,h&&h(),h=YA(m,250),io.hasAnimatedSinceResize&&(io.hasAnimatedSinceResize=!1,this.nodes.forEach(uf)))})}c&&this.root.registerSharedNode(c,this),this.options.animate!==!1&&u&&(c||l)&&this.addEventListener("didUpdate",({delta:h,hasLayoutChanged:f,hasRelativeLayoutChanged:m,layout:y})=>{if(this.isTreeAnimationBlocked()){this.target=void 0,this.relativeTarget=void 0;return}const w=this.options.transition||u.getDefaultTransition()||fR,{onLayoutAnimationStart:R,onLayoutAnimationComplete:I}=u.getProps(),P=!this.targetLayout||!oy(this.targetLayout,y),x=!f&&m;if(this.options.layoutRoot||this.resumeFrom||x||f&&(P||!this.currentAnimation)){this.resumeFrom&&(this.resumingFrom=this.resumeFrom,this.resumingFrom.resumingFrom=void 0);const V={...Yl(w,"layout"),onPlay:R,onComplete:I};(u.shouldReduceMotion||this.options.layoutRoot)&&(V.delay=0,V.type=!1),this.startAnimation(V),this.setAnimationOrigin(h,x)}else f||uf(this),this.isLead()&&this.options.onExitComplete&&this.options.onExitComplete();this.targetLayout=y})}unmount(){this.options.layoutId&&this.willUpdate(),this.root.nodes.remove(this);const o=this.getStack();o&&o.remove(this),this.parent&&this.parent.children.delete(this),this.instance=void 0,this.eventHandlers.clear(),qt(this.updateProjection)}blockUpdate(){this.updateManuallyBlocked=!0}unblockUpdate(){this.updateManuallyBlocked=!1}isUpdateBlocked(){return this.updateManuallyBlocked||this.updateBlockedByResize}isTreeAnimationBlocked(){return this.isAnimationBlocked||this.parent&&this.parent.isTreeAnimationBlocked()||!1}startUpdate(){this.isUpdateBlocked()||(this.isUpdating=!0,this.nodes&&this.nodes.forEach(lR),this.animationId++)}getTransformTemplate(){const{visualElement:o}=this.options;return o&&o.getProps().transformTemplate}willUpdate(o=!0){if(this.root.hasTreeAnimated=!0,this.root.isUpdateBlocked()){this.options.onExitComplete&&this.options.onExitComplete();return}if(window.MotionCancelOptimisedAnimation&&!this.hasCheckedOptimisedAppear&&ly(this),!this.root.isUpdating&&this.root.startUpdate(),this.isLayoutDirty)return;this.isLayoutDirty=!0;for(let h=0;h<this.path.length;h++){const f=this.path[h];f.shouldResetTransform=!0,(typeof f.latestValues.x=="string"||typeof f.latestValues.y=="string")&&(f.isLayoutDirty=!0),f.updateScroll("snapshot"),f.options.layoutRoot&&f.willUpdate(!1)}const{layoutId:c,layout:l}=this.options;if(c===void 0&&!l)return;const u=this.getTransformTemplate();this.prevTransformTemplateValue=u?u(this.latestValues,""):void 0,this.updateSnapshot(),o&&this.notifyListeners("willUpdate")}update(){if(this.updateScheduled=!1,this.isUpdateBlocked()){const l=this.updateBlockedByResize;this.unblockUpdate(),this.updateBlockedByResize=!1,this.clearAllSnapshots(),l&&this.nodes.forEach(sR),this.nodes.forEach(cf);return}if(this.animationId<=this.animationCommitId){this.nodes.forEach(lf);return}this.animationCommitId=this.animationId,this.isUpdating?(this.isUpdating=!1,this.nodes.forEach(iR),this.nodes.forEach(oR),this.nodes.forEach(ZA),this.nodes.forEach(eR)):this.nodes.forEach(lf),this.clearAllSnapshots();const c=Ye.now();Oe.delta=Vt(0,1e3/60,c-Oe.timestamp),Oe.timestamp=c,Oe.isProcessing=!0,Ka.update.process(Oe),Ka.preRender.process(Oe),Ka.render.process(Oe),Oe.isProcessing=!1}didUpdate(){this.updateScheduled||(this.updateScheduled=!0,eu.read(this.scheduleUpdate))}clearAllSnapshots(){this.nodes.forEach(rR),this.sharedNodes.forEach(uR)}scheduleUpdateProjection(){this.projectionUpdateScheduled||(this.projectionUpdateScheduled=!0,ae.preRender(this.updateProjection,!1,!0))}scheduleCheckAfterUnmount(){ae.postRender(()=>{this.isLayoutDirty?this.root.didUpdate():this.root.checkUpdateFailed()})}updateSnapshot(){this.snapshot||!this.instance||(this.snapshot=this.measure(),this.snapshot&&!Qe(this.snapshot.measuredBox.x)&&!Qe(this.snapshot.measuredBox.y)&&(this.snapshot=void 0))}updateLayout(){if(!this.instance||(this.updateScroll(),!(this.options.alwaysMeasureLayout&&this.isLead())&&!this.isLayoutDirty))return;if(this.resumeFrom&&!this.resumeFrom.instance)for(let l=0;l<this.path.length;l++)this.path[l].updateScroll();const o=this.layout;this.layout=this.measure(!1),this.layoutVersion++,this.layoutCorrected||(this.layoutCorrected=Ve()),this.isLayoutDirty=!1,this.projectionDelta=void 0,this.notifyListeners("measure",this.layout.layoutBox);const{visualElement:c}=this.options;c&&c.notify("LayoutMeasure",this.layout.layoutBox,o?o.layoutBox:void 0)}updateScroll(o="measure"){let c=!!(this.options.layoutScroll&&this.instance);if(this.scroll&&this.scroll.animationId===this.root.animationId&&this.scroll.phase===o&&(c=!1),c&&this.instance){const l=r(this.instance);this.scroll={animationId:this.root.animationId,phase:o,isRoot:l,offset:n(this.instance),wasRoot:this.scroll?this.scroll.isRoot:l}}}resetTransform(){if(!s)return;const o=this.isLayoutDirty||this.shouldResetTransform||this.options.alwaysMeasureLayout,c=this.projectionDelta&&!iy(this.projectionDelta),l=this.getTransformTemplate(),u=l?l(this.latestValues,""):void 0,h=u!==this.prevTransformTemplateValue;o&&this.instance&&(c||Wn(this.latestValues)||h)&&(s(this.instance,u),this.shouldResetTransform=!1,this.scheduleRender())}measure(o=!0){const c=this.measurePageBox();let l=this.removeElementScroll(c);return o&&(l=this.removeTransform(l)),pR(l),{animationId:this.root.animationId,measuredBox:c,layoutBox:l,latestValues:{},source:this.id}}measurePageBox(){var u;const{visualElement:o}=this.options;if(!o)return Ve();const c=o.measureViewportBox();if(!(((u=this.scroll)==null?void 0:u.wasRoot)||this.path.some(mR))){const{scroll:h}=this.root;h&&(At(c.x,h.offset.x),At(c.y,h.offset.y))}return c}removeElementScroll(o){var l;const c=Ve();if(ht(c,o),(l=this.scroll)!=null&&l.wasRoot)return c;for(let u=0;u<this.path.length;u++){const h=this.path[u],{scroll:f,options:m}=h;h!==this.root&&f&&m.layoutScroll&&(f.wasRoot&&ht(c,o),At(c.x,f.offset.x),At(c.y,f.offset.y))}return c}applyTransform(o,c=!1,l){var h,f;const u=l||Ve();ht(u,o);for(let m=0;m<this.path.length;m++){const y=this.path[m];!c&&y.options.layoutScroll&&y.scroll&&y!==y.root&&(At(u.x,-y.scroll.offset.x),At(u.y,-y.scroll.offset.y)),Wn(y.latestValues)&&ro(u,y.latestValues,(h=y.layout)==null?void 0:h.layoutBox)}return Wn(this.latestValues)&&ro(u,this.latestValues,(f=this.layout)==null?void 0:f.layoutBox),u}removeTransform(o){var l;const c=Ve();ht(c,o);for(let u=0;u<this.path.length;u++){const h=this.path[u];if(!Wn(h.latestValues))continue;let f;h.instance&&(Gc(h.latestValues)&&h.updateSnapshot(),f=Ve(),ht(f,h.measurePageBox())),Jd(c,h.latestValues,(l=h.snapshot)==null?void 0:l.layoutBox,f)}return Wn(this.latestValues)&&Jd(c,this.latestValues),c}setTargetDelta(o){this.targetDelta=o,this.root.scheduleUpdateProjection(),this.isProjectionDirty=!0}setOptions(o){this.options={...this.options,...o,crossfade:o.crossfade!==void 0?o.crossfade:!0}}clearMeasurements(){this.scroll=void 0,this.layout=void 0,this.snapshot=void 0,this.prevTransformTemplateValue=void 0,this.targetDelta=void 0,this.target=void 0,this.isLayoutDirty=!1}forceRelativeParentToResolveTarget(){this.relativeParent&&this.relativeParent.resolvedRelativeTargetAt!==Oe.timestamp&&this.relativeParent.resolveTargetDelta(!0)}resolveTargetDelta(o=!1){var y;const c=this.getLead();this.isProjectionDirty||(this.isProjectionDirty=c.isProjectionDirty),this.isTransformDirty||(this.isTransformDirty=c.isTransformDirty),this.isSharedProjectionDirty||(this.isSharedProjectionDirty=c.isSharedProjectionDirty);const l=!!this.resumingFrom||this!==c;if(!(o||l&&this.isSharedProjectionDirty||this.isProjectionDirty||(y=this.parent)!=null&&y.isProjectionDirty||this.attemptToResolveRelativeTarget||this.root.updateBlockedByResize))return;const{layout:h,layoutId:f}=this.options;if(!this.layout||!(h||f))return;this.resolvedRelativeTargetAt=Oe.timestamp;const m=this.getClosestProjectingParent();m&&this.linkedParentVersion!==m.layoutVersion&&!m.options.layoutRoot&&this.removeRelativeTarget(),!this.targetDelta&&!this.relativeTarget&&(this.options.layoutAnchor!==!1&&m&&m.layout?this.createRelativeTarget(m,this.layout.layoutBox,m.layout.layoutBox):this.removeRelativeTarget()),!(!this.relativeTarget&&!this.targetDelta)&&(this.target||(this.target=Ve(),this.targetWithTransforms=Ve()),this.relativeTarget&&this.relativeTargetOrigin&&this.relativeParent&&this.relativeParent.target?(this.forceRelativeParentToResolveTarget(),LA(this.target,this.relativeTarget,this.relativeParent.target,this.options.layoutAnchor||void 0)):this.targetDelta?(this.resumingFrom?this.applyTransform(this.layout.layoutBox,!1,this.target):ht(this.target,this.layout.layoutBox),Gg(this.target,this.targetDelta)):ht(this.target,this.layout.layoutBox),this.attemptToResolveRelativeTarget&&(this.attemptToResolveRelativeTarget=!1,this.options.layoutAnchor!==!1&&m&&!!m.resumingFrom==!!this.resumingFrom&&!m.options.layoutScroll&&m.target&&this.animationProgress!==1?this.createRelativeTarget(m,this.target,m.target):this.relativeParent=this.relativeTarget=void 0))}getClosestProjectingParent(){if(!(!this.parent||Gc(this.parent.latestValues)||Hg(this.parent.latestValues)))return this.parent.isProjecting()?this.parent:this.parent.getClosestProjectingParent()}isProjecting(){return!!((this.relativeTarget||this.targetDelta||this.options.layoutRoot)&&this.layout)}createRelativeTarget(o,c,l){this.relativeParent=o,this.linkedParentVersion=o.layoutVersion,this.forceRelativeParentToResolveTarget(),this.relativeTarget=Ve(),this.relativeTargetOrigin=Ve(),Ao(this.relativeTargetOrigin,c,l,this.options.layoutAnchor||void 0),ht(this.relativeTarget,this.relativeTargetOrigin)}removeRelativeTarget(){this.relativeParent=this.relativeTarget=void 0}calcProjection(){var w;const o=this.getLead(),c=!!this.resumingFrom||this!==o;let l=!0;if((this.isProjectionDirty||(w=this.parent)!=null&&w.isProjectionDirty)&&(l=!1),c&&(this.isSharedProjectionDirty||this.isTransformDirty)&&(l=!1),this.resolvedRelativeTargetAt===Oe.timestamp&&(l=!1),l)return;const{layout:u,layoutId:h}=this.options;if(this.isTreeAnimating=!!(this.parent&&this.parent.isTreeAnimating||this.currentAnimation||this.pendingAnimation),this.isTreeAnimating||(this.targetDelta=this.relativeTarget=void 0),!this.layout||!(u||h))return;ht(this.layoutCorrected,this.layout.layoutBox);const f=this.treeScale.x,m=this.treeScale.y;hA(this.layoutCorrected,this.treeScale,this.path,c),o.layout&&!o.target&&(this.treeScale.x!==1||this.treeScale.y!==1)&&(o.target=o.layout.layoutBox,o.targetWithTransforms=Ve());const{target:y}=o;if(!y){this.prevProjectionDelta&&(this.createProjectionDeltas(),this.scheduleRender());return}!this.projectionDelta||!this.prevProjectionDelta?this.createProjectionDeltas():(Hd(this.prevProjectionDelta.x,this.projectionDelta.x),Hd(this.prevProjectionDelta.y,this.projectionDelta.y)),xs(this.projectionDelta,this.layoutCorrected,y,this.latestValues),(this.treeScale.x!==f||this.treeScale.y!==m||!rf(this.projectionDelta.x,this.prevProjectionDelta.x)||!rf(this.projectionDelta.y,this.prevProjectionDelta.y))&&(this.hasProjected=!0,this.scheduleRender(),this.notifyListeners("projectionUpdate",y))}hide(){this.isVisible=!1}show(){this.isVisible=!0}scheduleRender(o=!0){var c;if((c=this.options.visualElement)==null||c.scheduleRender(),o){const l=this.getStack();l&&l.scheduleRender()}this.resumingFrom&&!this.resumingFrom.instance&&(this.resumingFrom=void 0)}createProjectionDeltas(){this.prevProjectionDelta=Ar(),this.projectionDelta=Ar(),this.projectionDeltaWithTransform=Ar()}setAnimationOrigin(o,c=!1){const l=this.snapshot,u=l?l.latestValues:{},h={...this.latestValues},f=Ar();(!this.relativeParent||!this.relativeParent.options.layoutRoot)&&(this.relativeTarget=this.relativeTargetOrigin=void 0),this.attemptToResolveRelativeTarget=!c;const m=Ve(),y=l?l.source:void 0,w=this.layout?this.layout.source:void 0,R=y!==w,I=this.getStack(),P=!I||I.members.length<=1,x=!!(R&&!P&&this.options.crossfade===!0&&!this.path.some(dR));this.animationProgress=0;let V;this.mixTargetDelta=L=>{const O=L/1e3;hf(f.x,o.x,O),hf(f.y,o.y,O),this.setTargetDelta(f),this.relativeTarget&&this.relativeTargetOrigin&&this.layout&&this.relativeParent&&this.relativeParent.layout&&(Ao(m,this.layout.layoutBox,this.relativeParent.layout.layoutBox,this.options.layoutAnchor||void 0),hR(this.relativeTarget,this.relativeTargetOrigin,m,O),V&&BA(this.relativeTarget,V)&&(this.isProjectionDirty=!1),V||(V=Ve()),ht(V,this.relativeTarget)),R&&(this.animationValues=h,zA(h,u,this.latestValues,O,x,P)),this.root.scheduleUpdateProjection(),this.scheduleRender(),this.animationProgress=O},this.mixTargetDelta(this.options.layoutRoot?1e3:0)}startAnimation(o){var c,l,u;this.notifyListeners("animationStart"),(c=this.currentAnimation)==null||c.stop(),(u=(l=this.resumingFrom)==null?void 0:l.currentAnimation)==null||u.stop(),this.pendingAnimation&&(qt(this.pendingAnimation),this.pendingAnimation=void 0),this.pendingAnimation=ae.update(()=>{io.hasAnimatedSinceResize=!0,this.motionValue||(this.motionValue=tr(0)),this.motionValue.jump(0,!1),this.currentAnimation=HA(this.motionValue,[0,1e3],{...o,velocity:0,isSync:!0,onUpdate:h=>{this.mixTargetDelta(h),o.onUpdate&&o.onUpdate(h)},onStop:()=>{},onComplete:()=>{o.onComplete&&o.onComplete(),this.completeAnimation()}}),this.resumingFrom&&(this.resumingFrom.currentAnimation=this.currentAnimation),this.pendingAnimation=void 0})}completeAnimation(){this.resumingFrom&&(this.resumingFrom.currentAnimation=void 0,this.resumingFrom.preserveOpacity=void 0);const o=this.getStack();o&&o.exitAnimationComplete(),this.resumingFrom=this.currentAnimation=this.animationValues=void 0,this.notifyListeners("animationComplete")}finishAnimation(){this.currentAnimation&&(this.mixTargetDelta&&this.mixTargetDelta(XA),this.currentAnimation.stop()),this.completeAnimation()}applyTransformsToTarget(){const o=this.getLead();let{targetWithTransforms:c,target:l,layout:u,latestValues:h}=o;if(!(!c||!l||!u)){if(this!==o&&this.layout&&u&&hy(this.options.animationType,this.layout.layoutBox,u.layoutBox)){l=this.target||Ve();const f=Qe(this.layout.layoutBox.x);l.x.min=o.target.x.min,l.x.max=l.x.min+f;const m=Qe(this.layout.layoutBox.y);l.y.min=o.target.y.min,l.y.max=l.y.min+m}ht(c,l),ro(c,h),xs(this.projectionDeltaWithTransform,this.layoutCorrected,c,h)}}registerSharedNode(o,c){this.sharedNodes.has(o)||this.sharedNodes.set(o,new QA),this.sharedNodes.get(o).add(c);const u=c.options.initialPromotionConfig;c.promote({transition:u?u.transition:void 0,preserveFollowOpacity:u&&u.shouldPreserveFollowOpacity?u.shouldPreserveFollowOpacity(c):void 0})}isLead(){const o=this.getStack();return o?o.lead===this:!0}getLead(){var c;const{layoutId:o}=this.options;return o?((c=this.getStack())==null?void 0:c.lead)||this:this}getPrevLead(){var c;const{layoutId:o}=this.options;return o?(c=this.getStack())==null?void 0:c.prevLead:void 0}getStack(){const{layoutId:o}=this.options;if(o)return this.root.sharedNodes.get(o)}promote({needsReset:o,transition:c,preserveFollowOpacity:l}={}){const u=this.getStack();u&&u.promote(this,l),o&&(this.projectionDelta=void 0,this.needsReset=!0),c&&this.setOptions({transition:c})}relegate(){const o=this.getStack();return o?o.relegate(this):!1}resetSkewAndRotation(){const{visualElement:o}=this.options;if(!o)return;let c=!1;const{latestValues:l}=o;if((l.z||l.rotate||l.rotateX||l.rotateY||l.rotateZ||l.skewX||l.skewY)&&(c=!0),!c)return;const u={};l.z&&rc("z",o,u,this.animationValues);for(let h=0;h<nc.length;h++)rc(`rotate${nc[h]}`,o,u,this.animationValues),rc(`skew${nc[h]}`,o,u,this.animationValues);o.render();for(const h in u)o.setStaticValue(h,u[h]),this.animationValues&&(this.animationValues[h]=u[h]);o.scheduleRender()}applyProjectionStyles(o,c){if(!this.instance||this.isSVG)return;if(!this.isVisible){o.visibility="hidden";return}const l=this.getTransformTemplate();if(this.needsReset){this.needsReset=!1,o.visibility="",o.opacity="",o.pointerEvents=so(c==null?void 0:c.pointerEvents)||"",o.transform=l?l(this.latestValues,""):"none";return}const u=this.getLead();if(!this.projectionDelta||!this.layout||!u.target){this.options.layoutId&&(o.opacity=this.latestValues.opacity!==void 0?this.latestValues.opacity:1,o.pointerEvents=so(c==null?void 0:c.pointerEvents)||""),this.hasProjected&&!Wn(this.latestValues)&&(o.transform=l?l({},""):"none",this.hasProjected=!1);return}o.visibility="";const h=u.animationValues||u.latestValues;this.applyTransformsToTarget();let f=jA(this.projectionDeltaWithTransform,this.treeScale,h);l&&(f=l(h,f)),o.transform=f;const{x:m,y}=this.projectionDelta;o.transformOrigin=`${m.origin*100}% ${y.origin*100}% 0`,u.animationValues?o.opacity=u===this?h.opacity??this.latestValues.opacity??1:this.preserveOpacity?this.latestValues.opacity:h.opacityExit:o.opacity=u===this?h.opacity!==void 0?h.opacity:"":h.opacityExit!==void 0?h.opacityExit:0;for(const w in Yc){if(h[w]===void 0)continue;const{correct:R,applyTo:I,isCSSVariable:P}=Yc[w],x=f==="none"?h[w]:R(h[w],u);if(I){const V=I.length;for(let L=0;L<V;L++)o[I[L]]=x}else P?this.options.visualElement.renderState.vars[w]=x:o[w]=x}this.options.layoutId&&(o.pointerEvents=u===this?so(c==null?void 0:c.pointerEvents)||"":"none")}clearSnapshot(){this.resumeFrom=this.snapshot=void 0}resetTree(){this.root.nodes.forEach(o=>{var c;return(c=o.currentAnimation)==null?void 0:c.stop()}),this.root.nodes.forEach(cf),this.root.sharedNodes.clear()}}}function ZA(t){t.updateLayout()}function eR(t){var n;const e=((n=t.resumeFrom)==null?void 0:n.snapshot)||t.snapshot;if(t.isLead()&&t.layout&&e&&t.hasListeners("didUpdate")){const{layoutBox:r,measuredBox:s}=t.layout,{animationType:i}=t.options,o=e.source!==t.layout.source;if(i==="size")It(f=>{const m=o?e.measuredBox[f]:e.layoutBox[f],y=Qe(m);m.min=r[f].min,m.max=m.min+y});else if(i==="x"||i==="y"){const f=i==="x"?"y":"x";Qc(o?e.measuredBox[f]:e.layoutBox[f],r[f])}else hy(i,e.layoutBox,r)&&It(f=>{const m=o?e.measuredBox[f]:e.layoutBox[f],y=Qe(r[f]);m.max=m.min+y,t.relativeTarget&&!t.currentAnimation&&(t.isProjectionDirty=!0,t.relativeTarget[f].max=t.relativeTarget[f].min+y)});const c=Ar();xs(c,r,e.layoutBox);const l=Ar();o?xs(l,t.applyTransform(s,!0),e.measuredBox):xs(l,r,e.layoutBox);const u=!iy(c);let h=!1;if(!t.resumeFrom){const f=t.getClosestProjectingParent();if(f&&!f.resumeFrom){const{snapshot:m,layout:y}=f;if(m&&y){const w=t.options.layoutAnchor||void 0,R=Ve();Ao(R,e.layoutBox,m.layoutBox,w);const I=Ve();Ao(I,r,y.layoutBox,w),oy(R,I)||(h=!0),f.options.layoutRoot&&(t.relativeTarget=I,t.relativeTargetOrigin=R,t.relativeParent=f)}}}t.notifyListeners("didUpdate",{layout:r,snapshot:e,delta:l,layoutDelta:c,hasLayoutChanged:u,hasRelativeLayoutChanged:h})}else if(t.isLead()){const{onExitComplete:r}=t.options;r&&r()}t.options.transition=void 0}function tR(t){t.parent&&(t.isProjecting()||(t.isProjectionDirty=t.parent.isProjectionDirty),t.isSharedProjectionDirty||(t.isSharedProjectionDirty=!!(t.isProjectionDirty||t.parent.isProjectionDirty||t.parent.isSharedProjectionDirty)),t.isTransformDirty||(t.isTransformDirty=t.parent.isTransformDirty))}function nR(t){t.isProjectionDirty=t.isSharedProjectionDirty=t.isTransformDirty=!1}function rR(t){t.clearSnapshot()}function cf(t){t.clearMeasurements()}function sR(t){t.isLayoutDirty=!0,t.updateLayout()}function lf(t){t.isLayoutDirty=!1}function iR(t){t.isAnimationBlocked&&t.layout&&!t.isLayoutDirty&&(t.snapshot=t.layout,t.isLayoutDirty=!0)}function oR(t){const{visualElement:e}=t.options;e&&e.getProps().onBeforeLayoutMeasure&&e.notify("BeforeLayoutMeasure"),t.resetTransform()}function uf(t){t.finishAnimation(),t.targetDelta=t.relativeTarget=t.target=void 0,t.isProjectionDirty=!0}function aR(t){t.resolveTargetDelta()}function cR(t){t.calcProjection()}function lR(t){t.resetSkewAndRotation()}function uR(t){t.removeLeadSnapshot()}function hf(t,e,n){t.translate=he(e.translate,0,n),t.scale=he(e.scale,1,n),t.origin=e.origin,t.originPoint=e.originPoint}function df(t,e,n,r){t.min=he(e.min,n.min,r),t.max=he(e.max,n.max,r)}function hR(t,e,n,r){df(t.x,e.x,n.x,r),df(t.y,e.y,n.y,r)}function dR(t){return t.animationValues&&t.animationValues.opacityExit!==void 0}const fR={duration:.45,ease:[.4,0,.1,1]},ff=t=>typeof navigator<"u"&&navigator.userAgent&&navigator.userAgent.toLowerCase().includes(t),pf=ff("applewebkit/")&&!ff("chrome/")?Math.round:ut;function mf(t){t.min=pf(t.min),t.max=pf(t.max)}function pR(t){mf(t.x),mf(t.y)}function hy(t,e,n){return t==="position"||t==="preserve-aspect"&&!NA(nf(e),nf(n),.2)}function mR(t){var e;return t!==t.root&&((e=t.scroll)==null?void 0:e.wasRoot)}const gR=uy({attachResizeListener:(t,e)=>qs(t,"resize",e),measureScroll:()=>{var t,e;return{x:document.documentElement.scrollLeft||((t=document.body)==null?void 0:t.scrollLeft)||0,y:document.documentElement.scrollTop||((e=document.body)==null?void 0:e.scrollTop)||0}},checkIsScrollRoot:()=>!0}),sc={current:void 0},dy=uy({measureScroll:t=>({x:t.scrollLeft,y:t.scrollTop}),defaultParent:()=>{if(!sc.current){const t=new gR({});t.mount(window),t.setOptions({layoutScroll:!0}),sc.current=t}return sc.current},resetTransform:(t,e)=>{t.style.transform=e!==void 0?e:"none"},checkIsScrollRoot:t=>window.getComputedStyle(t).position==="fixed"}),ta=S.createContext({transformPagePoint:t=>t,isStatic:!1,reducedMotion:"never"});function gf(t,e){if(typeof t=="function")return t(e);t!=null&&(t.current=e)}function yR(...t){return e=>{let n=!1;const r=t.map(s=>{const i=gf(s,e);return!n&&typeof i=="function"&&(n=!0),i});if(n)return()=>{for(let s=0;s<r.length;s++){const i=r[s];typeof i=="function"?i():gf(t[s],null)}}}}function _R(...t){return S.useCallback(yR(...t),t)}class vR extends S.Component{getSnapshotBeforeUpdate(e){const n=this.props.childRef.current;if(Zi(n)&&e.isPresent&&!this.props.isPresent&&this.props.pop!==!1){const r=n.offsetParent,s=Zi(r)&&r.offsetWidth||0,i=Zi(r)&&r.offsetHeight||0,o=getComputedStyle(n),c=this.props.sizeRef.current;c.height=parseFloat(o.height),c.width=parseFloat(o.width),c.top=n.offsetTop,c.left=n.offsetLeft,c.right=s-c.width-c.left,c.bottom=i-c.height-c.top}return null}componentDidUpdate(){}render(){return this.props.children}}function wR({children:t,isPresent:e,anchorX:n,anchorY:r,root:s,pop:i}){var m;const o=S.useId(),c=S.useRef(null),l=S.useRef({width:0,height:0,top:0,left:0,right:0,bottom:0}),{nonce:u}=S.useContext(ta),h=((m=t.props)==null?void 0:m.ref)??(t==null?void 0:t.ref),f=_R(c,h);return S.useInsertionEffect(()=>{const{width:y,height:w,top:R,left:I,right:P,bottom:x}=l.current;if(e||i===!1||!c.current||!y||!w)return;const V=n==="left"?`left: ${I}`:`right: ${P}`,L=r==="bottom"?`bottom: ${x}`:`top: ${R}`;c.current.dataset.motionPopId=o;const O=document.createElement("style");u&&(O.nonce=u);const z=s??document.head;return z.appendChild(O),O.sheet&&O.sheet.insertRule(`
          [data-motion-pop-id="${o}"] {
            position: absolute !important;
            width: ${y}px !important;
            height: ${w}px !important;
            ${V}px !important;
            ${L}px !important;
          }
        `),()=>{var b;(b=c.current)==null||b.removeAttribute("data-motion-pop-id"),z.contains(O)&&z.removeChild(O)}},[e]),lt.jsx(vR,{isPresent:e,childRef:c,sizeRef:l,pop:i,children:i===!1?t:S.cloneElement(t,{ref:f})})}const TR=({children:t,initial:e,isPresent:n,onExitComplete:r,custom:s,presenceAffectsLayout:i,mode:o,anchorX:c,anchorY:l,root:u})=>{const h=Pn(ER),f=S.useId();let m=!0,y=S.useMemo(()=>(m=!1,{id:f,initial:e,isPresent:n,custom:s,onExitComplete:w=>{h.set(w,!0);for(const R of h.values())if(!R)return;r&&r()},register:w=>(h.set(w,!1),()=>h.delete(w))}),[n,h,r]);return i&&m&&(y={...y}),S.useMemo(()=>{h.forEach((w,R)=>h.set(R,!1))},[n]),S.useEffect(()=>{!n&&!h.size&&r&&r()},[n]),t=lt.jsx(wR,{pop:o==="popLayout",isPresent:n,anchorX:c,anchorY:l,root:u,children:t}),lt.jsx(Xo.Provider,{value:y,children:t})};function ER(){return new Map}function fy(t=!0){const e=S.useContext(Xo);if(e===null)return[!0,null];const{isPresent:n,onExitComplete:r,register:s}=e,i=S.useId();S.useEffect(()=>{if(t)return s(i)},[t]);const o=S.useCallback(()=>t&&r&&r(i),[i,r,t]);return!n&&r?[!1,o]:[!0]}const Fi=t=>t.key||"";function yf(t){const e=[];return S.Children.forEach(t,n=>{S.isValidElement(n)&&e.push(n)}),e}const rN=({children:t,custom:e,initial:n=!0,onExitComplete:r,presenceAffectsLayout:s=!0,mode:i="sync",propagate:o=!1,anchorX:c="left",anchorY:l="top",root:u})=>{const[h,f]=fy(o),m=S.useMemo(()=>yf(t),[t]),y=o&&!h?[]:m.map(Fi),w=S.useRef(!0),R=S.useRef(m),I=Pn(()=>new Map),P=S.useRef(new Set),[x,V]=S.useState(m),[L,O]=S.useState(m);Ll(()=>{w.current=!1,R.current=m;for(let g=0;g<L.length;g++){const v=Fi(L[g]);y.includes(v)?(I.delete(v),P.current.delete(v)):I.get(v)!==!0&&I.set(v,!1)}},[L,y.length,y.join("-")]);const z=[];if(m!==x){let g=[...m];for(let v=0;v<L.length;v++){const E=L[v],A=Fi(E);y.includes(A)||(g.splice(v,0,E),z.push(E))}return i==="wait"&&z.length&&(g=z),O(yf(g)),V(m),null}const{forceRender:b}=S.useContext(Nl);return lt.jsx(lt.Fragment,{children:L.map(g=>{const v=Fi(g),E=o&&!h?!1:m===L||y.includes(v),A=()=>{if(P.current.has(v))return;if(I.has(v))P.current.add(v),I.set(v,!0);else return;let C=!0;I.forEach(T=>{T||(C=!1)}),C&&(b==null||b(),O(R.current),o&&(f==null||f()),r&&r())};return lt.jsx(TR,{isPresent:E,initial:!w.current||n?void 0:!1,custom:e,presenceAffectsLayout:s,mode:i,root:u,onExitComplete:E?void 0:A,anchorX:c,anchorY:l,children:g},v)})})},py=S.createContext({strict:!1}),_f={animation:["animate","variants","whileHover","whileTap","exit","whileInView","whileFocus","whileDrag"],exit:["exit"],drag:["drag","dragControls"],focus:["whileFocus"],hover:["whileHover","onHoverStart","onHoverEnd"],tap:["whileTap","onTap","onTapStart","onTapCancel"],pan:["onPan","onPanStart","onPanSessionStart","onPanEnd"],inView:["whileInView","onViewportEnter","onViewportLeave"],layout:["layout","layoutId"]};let vf=!1;function IR(){if(vf)return;const t={};for(const e in _f)t[e]={isEnabled:n=>_f[e].some(r=>!!n[r])};zg(t),vf=!0}function my(){return IR(),aA()}function bR(t){const e=my();for(const n in t)e[n]={...e[n],...t[n]};zg(e)}const AR=new Set(["animate","exit","variants","initial","style","values","variants","transition","transformTemplate","custom","inherit","onBeforeLayoutMeasure","onAnimationStart","onAnimationComplete","onUpdate","onDragStart","onDrag","onDragEnd","onMeasureDragConstraints","onDirectionLock","onDragTransitionEnd","_dragX","_dragY","onHoverStart","onHoverEnd","onViewportEnter","onViewportLeave","globalTapTarget","propagate","ignoreStrict","viewport"]);function Ro(t){return t.startsWith("while")||t.startsWith("drag")&&t!=="draggable"||t.startsWith("layout")||t.startsWith("onTap")||t.startsWith("onPan")||t.startsWith("onLayout")||AR.has(t)}let gy=t=>!Ro(t);function RR(t){typeof t=="function"&&(gy=e=>e.startsWith("on")?!Ro(e):t(e))}try{RR(require("@emotion/is-prop-valid").default)}catch{}function SR(t,e,n){const r={};for(const s in t)s==="values"&&typeof t.values=="object"||Le(t[s])||(gy(s)||n===!0&&Ro(s)||!e&&!Ro(s)||t.draggable&&s.startsWith("onDrag"))&&(r[s]=t[s]);return r}const na=S.createContext({});function PR(t,e){if(ea(t)){const{initial:n,animate:r}=t;return{initial:n===!1||zs(n)?n:void 0,animate:zs(r)?r:void 0}}return t.inherit!==!1?e:{}}function CR(t){const{initial:e,animate:n}=PR(t,S.useContext(na));return S.useMemo(()=>({initial:e,animate:n}),[wf(e),wf(n)])}function wf(t){return Array.isArray(t)?t.join(" "):t}const au=()=>({style:{},transform:{},transformOrigin:{},vars:{}});function yy(t,e,n){for(const r in e)!Le(e[r])&&!Qg(r,n)&&(t[r]=e[r])}function kR({transformTemplate:t},e){return S.useMemo(()=>{const n=au();return iu(n,e,t),Object.assign({},n.vars,n.style)},[e])}function xR(t,e){const n=t.style||{},r={};return yy(r,n,t),Object.assign(r,kR(t,e)),r}function VR(t,e){const n={},r=xR(t,e);return t.drag&&t.dragListener!==!1&&(n.draggable=!1,r.userSelect=r.WebkitUserSelect=r.WebkitTouchCallout="none",r.touchAction=t.drag===!0?"none":`pan-${t.drag==="x"?"y":"x"}`),t.tabIndex===void 0&&(t.onTap||t.onTapStart||t.whileTap)&&(n.tabIndex=0),n.style=r,n}const _y=()=>({...au(),attrs:{}});function DR(t,e,n,r){const s=S.useMemo(()=>{const i=_y();return Xg(i,e,Zg(r),t.transformTemplate,t.style),{...i.attrs,style:{...i.style}}},[e]);if(t.style){const i={};yy(i,t.style,t),s.style={...i,...s.style}}return s}const MR=["animate","circle","defs","desc","ellipse","g","image","line","filter","marker","mask","metadata","path","pattern","polygon","polyline","rect","stop","switch","symbol","svg","text","tspan","use","view"];function cu(t){return typeof t!="string"||t.includes("-")?!1:!!(MR.indexOf(t)>-1||/[A-Z]/u.test(t))}function NR(t,e,n,{latestValues:r},s,i=!1,o){const l=(o??cu(t)?DR:VR)(e,r,s,t),u=SR(e,typeof t=="string",i),h=t!==S.Fragment?{...u,...l,ref:n}:{},{children:f}=e,m=S.useMemo(()=>Le(f)?f.get():f,[f]);return S.createElement(t,{...h,children:m})}function LR({scrapeMotionValuesFromProps:t,createRenderState:e},n,r,s){return{latestValues:OR(n,r,s,t),renderState:e()}}function OR(t,e,n,r){const s={},i=r(t,{});for(const m in i)s[m]=so(i[m]);let{initial:o,animate:c}=t;const l=ea(t),u=jg(t);e&&u&&!l&&t.inherit!==!1&&(o===void 0&&(o=e.initial),c===void 0&&(c=e.animate));let h=n?n.initial===!1:!1;h=h||o===!1;const f=h?c:o;if(f&&typeof f!="boolean"&&!Zo(f)){const m=Array.isArray(f)?f:[f];for(let y=0;y<m.length;y++){const w=Xl(t,m[y]);if(w){const{transitionEnd:R,transition:I,...P}=w;for(const x in P){let V=P[x];if(Array.isArray(V)){const L=h?V.length-1:0;V=V[L]}V!==null&&(s[x]=V)}for(const x in R)s[x]=R[x]}}}return s}const vy=t=>(e,n)=>{const r=S.useContext(na),s=S.useContext(Xo),i=()=>LR(t,e,r,s);return n?i():Pn(i)},FR=vy({scrapeMotionValuesFromProps:ou,createRenderState:au}),UR=vy({scrapeMotionValuesFromProps:ey,createRenderState:_y}),BR=Symbol.for("motionComponentSymbol");function jR(t,e,n){const r=S.useRef(n);S.useInsertionEffect(()=>{r.current=n});const s=S.useRef(null);return S.useCallback(i=>{var c;i&&((c=t.onMount)==null||c.call(t,i));const o=r.current;if(typeof o=="function")if(i){const l=o(i);typeof l=="function"&&(s.current=l)}else s.current?(s.current(),s.current=null):o(i);else o&&(o.current=i);e&&(i?e.mount(i):e.unmount())},[e])}const wy=S.createContext({});function _r(t){return t&&typeof t=="object"&&Object.prototype.hasOwnProperty.call(t,"current")}function $R(t,e,n,r,s,i){var V,L;const{visualElement:o}=S.useContext(na),c=S.useContext(py),l=S.useContext(Xo),u=S.useContext(ta),h=u.reducedMotion,f=u.skipAnimations,m=S.useRef(null),y=S.useRef(!1);r=r||c.renderer,!m.current&&r&&(m.current=r(t,{visualState:e,parent:o,props:n,presenceContext:l,blockInitialAnimation:l?l.initial===!1:!1,reducedMotionConfig:h,skipAnimations:f,isSVG:i}),y.current&&m.current&&(m.current.manuallyAnimateOnMount=!0));const w=m.current,R=S.useContext(wy);w&&!w.projection&&s&&(w.type==="html"||w.type==="svg")&&zR(m.current,n,s,R);const I=S.useRef(!1);S.useInsertionEffect(()=>{w&&I.current&&w.update(n,l)});const P=n[Pg],x=S.useRef(!!P&&typeof window<"u"&&!((V=window.MotionHandoffIsComplete)!=null&&V.call(window,P))&&((L=window.MotionHasOptimisedAnimation)==null?void 0:L.call(window,P)));return Ll(()=>{y.current=!0,w&&(I.current=!0,window.MotionIsMounted=!0,w.updateFeatures(),w.scheduleRenderMicrotask(),x.current&&w.animationState&&w.animationState.animateChanges())}),S.useEffect(()=>{w&&(!x.current&&w.animationState&&w.animationState.animateChanges(),x.current&&(queueMicrotask(()=>{var O;(O=window.MotionHandoffMarkAsComplete)==null||O.call(window,P)}),x.current=!1),w.enteringChildren=void 0)}),w}function zR(t,e,n,r){const{layoutId:s,layout:i,drag:o,dragConstraints:c,layoutScroll:l,layoutRoot:u,layoutAnchor:h,layoutCrossfade:f}=e;t.projection=new n(t.latestValues,e["data-framer-portal-id"]?void 0:Ty(t.parent)),t.projection.setOptions({layoutId:s,layout:i,alwaysMeasureLayout:!!o||c&&_r(c),visualElement:t,animationType:typeof i=="string"?i:"both",initialPromotionConfig:r,crossfade:f,layoutScroll:l,layoutRoot:u,layoutAnchor:h})}function Ty(t){if(t)return t.options.allowProjection!==!1?t.projection:Ty(t.parent)}function ic(t,{forwardMotionProps:e=!1,type:n}={},r,s){r&&bR(r);const i=n?n==="svg":cu(t),o=i?UR:FR;function c(u,h){let f;const m={...S.useContext(ta),...u,layoutId:qR(u)},{isStatic:y}=m,w=CR(u),R=o(u,y);if(!y&&typeof window<"u"){WR();const I=HR(m);f=I.MeasureLayout,w.visualElement=$R(t,R,m,s,I.ProjectionNode,i)}return lt.jsxs(na.Provider,{value:w,children:[f&&w.visualElement?lt.jsx(f,{visualElement:w.visualElement,...m}):null,NR(t,u,jR(R,w.visualElement,h),R,y,e,i)]})}c.displayName=`motion.${typeof t=="string"?t:`create(${t.displayName??t.name??""})`}`;const l=S.forwardRef(c);return l[BR]=t,l}function qR({layoutId:t}){const e=S.useContext(Nl).id;return e&&t!==void 0?e+"-"+t:t}function WR(t,e){S.useContext(py).strict}function HR(t){const e=my(),{drag:n,layout:r}=e;if(!n&&!r)return{};const s={...n,...r};return{MeasureLayout:n!=null&&n.isEnabled(t)||r!=null&&r.isEnabled(t)?s.MeasureLayout:void 0,ProjectionNode:s.ProjectionNode}}function GR(t,e){if(typeof Proxy>"u")return ic;const n=new Map,r=(i,o)=>ic(i,o,t,e),s=(i,o)=>r(i,o);return new Proxy(s,{get:(i,o)=>o==="create"?r:(n.has(o)||n.set(o,ic(o,void 0,t,e)),n.get(o))})}const KR=(t,e)=>e.isSVG??cu(t)?new bA(e):new _A(e,{allowProjection:t!==S.Fragment});class YR extends Cn{constructor(e){super(e),e.animationState||(e.animationState=CA(e))}updateAnimationControlsSubscription(){const{animate:e}=this.node.getProps();Zo(e)&&(this.unmountControls=e.subscribe(this.node))}mount(){this.updateAnimationControlsSubscription()}update(){const{animate:e}=this.node.getProps(),{animate:n}=this.node.prevProps||{};e!==n&&this.updateAnimationControlsSubscription()}unmount(){var e;this.node.animationState.reset(),(e=this.unmountControls)==null||e.call(this)}}let QR=0;class XR extends Cn{constructor(){super(...arguments),this.id=QR++,this.isExitComplete=!1}update(){var i;if(!this.node.presenceContext)return;const{isPresent:e,onExitComplete:n}=this.node.presenceContext,{isPresent:r}=this.node.prevPresenceContext||{};if(!this.node.animationState||e===r)return;if(e&&r===!1){if(this.isExitComplete){const{initial:o,custom:c}=this.node.getProps();if(typeof o=="string"){const l=Jn(this.node,o,c);if(l){const{transition:u,transitionEnd:h,...f}=l;for(const m in f)(i=this.node.getValue(m))==null||i.jump(f[m])}}this.node.animationState.reset(),this.node.animationState.animateChanges()}else this.node.animationState.setActive("exit",!1);this.isExitComplete=!1;return}const s=this.node.animationState.setActive("exit",!e);n&&!e&&s.then(()=>{this.isExitComplete=!0,n(this.id)})}mount(){const{register:e,onExitComplete:n}=this.node.presenceContext||{};n&&n(this.id),e&&(this.unmount=e(this.id))}unmount(){}}const JR={animation:{Feature:YR},exit:{Feature:XR}};function ai(t){return{point:{x:t.pageX,y:t.pageY}}}const ZR=t=>e=>tu(e)&&t(e,ai(e));function Vs(t,e,n,r){return qs(t,e,ZR(n),r)}const Ey=({current:t})=>t?t.ownerDocument.defaultView:null,Tf=(t,e)=>Math.abs(t-e);function eS(t,e){const n=Tf(t.x,e.x),r=Tf(t.y,e.y);return Math.sqrt(n**2+r**2)}const Ef=new Set(["auto","scroll"]);class Iy{constructor(e,n,{transformPagePoint:r,contextWindow:s=window,dragSnapToOrigin:i=!1,distanceThreshold:o=3,element:c}={}){if(this.startEvent=null,this.lastMoveEvent=null,this.lastMoveEventInfo=null,this.lastRawMoveEventInfo=null,this.handlers={},this.contextWindow=window,this.scrollPositions=new Map,this.removeScrollListeners=null,this.onElementScroll=y=>{this.handleScroll(y.target)},this.onWindowScroll=()=>{this.handleScroll(window)},this.updatePoint=()=>{if(!(this.lastMoveEvent&&this.lastMoveEventInfo))return;this.lastRawMoveEventInfo&&(this.lastMoveEventInfo=Ui(this.lastRawMoveEventInfo,this.transformPagePoint));const y=oc(this.lastMoveEventInfo,this.history),w=this.startEvent!==null,R=eS(y.offset,{x:0,y:0})>=this.distanceThreshold;if(!w&&!R)return;const{point:I}=y,{timestamp:P}=Oe;this.history.push({...I,timestamp:P});const{onStart:x,onMove:V}=this.handlers;w||(x&&x(this.lastMoveEvent,y),this.startEvent=this.lastMoveEvent),V&&V(this.lastMoveEvent,y)},this.handlePointerMove=(y,w)=>{this.lastMoveEvent=y,this.lastRawMoveEventInfo=w,this.lastMoveEventInfo=Ui(w,this.transformPagePoint),ae.update(this.updatePoint,!0)},this.handlePointerUp=(y,w)=>{this.end();const{onEnd:R,onSessionEnd:I,resumeAnimation:P}=this.handlers;if((this.dragSnapToOrigin||!this.startEvent)&&P&&P(),!(this.lastMoveEvent&&this.lastMoveEventInfo))return;const x=oc(y.type==="pointercancel"?this.lastMoveEventInfo:Ui(w,this.transformPagePoint),this.history);this.startEvent&&R&&R(y,x),I&&I(y,x)},!tu(e))return;this.dragSnapToOrigin=i,this.handlers=n,this.transformPagePoint=r,this.distanceThreshold=o,this.contextWindow=s||window;const l=ai(e),u=Ui(l,this.transformPagePoint),{point:h}=u,{timestamp:f}=Oe;this.history=[{...h,timestamp:f}];const{onSessionStart:m}=n;m&&m(e,oc(u,this.history)),this.removeListeners=si(Vs(this.contextWindow,"pointermove",this.handlePointerMove),Vs(this.contextWindow,"pointerup",this.handlePointerUp),Vs(this.contextWindow,"pointercancel",this.handlePointerUp)),c&&this.startScrollTracking(c)}startScrollTracking(e){let n=e.parentElement;for(;n;){const r=getComputedStyle(n);(Ef.has(r.overflowX)||Ef.has(r.overflowY))&&this.scrollPositions.set(n,{x:n.scrollLeft,y:n.scrollTop}),n=n.parentElement}this.scrollPositions.set(window,{x:window.scrollX,y:window.scrollY}),window.addEventListener("scroll",this.onElementScroll,{capture:!0}),window.addEventListener("scroll",this.onWindowScroll),this.removeScrollListeners=()=>{window.removeEventListener("scroll",this.onElementScroll,{capture:!0}),window.removeEventListener("scroll",this.onWindowScroll)}}handleScroll(e){const n=this.scrollPositions.get(e);if(!n)return;const r=e===window,s=r?{x:window.scrollX,y:window.scrollY}:{x:e.scrollLeft,y:e.scrollTop},i={x:s.x-n.x,y:s.y-n.y};i.x===0&&i.y===0||(r?this.lastMoveEventInfo&&(this.lastMoveEventInfo.point.x+=i.x,this.lastMoveEventInfo.point.y+=i.y):this.history.length>0&&(this.history[0].x-=i.x,this.history[0].y-=i.y),this.scrollPositions.set(e,s),ae.update(this.updatePoint,!0))}updateHandlers(e){this.handlers=e}end(){this.removeListeners&&this.removeListeners(),this.removeScrollListeners&&this.removeScrollListeners(),this.scrollPositions.clear(),qt(this.updatePoint)}}function Ui(t,e){return e?{point:e(t.point)}:t}function If(t,e){return{x:t.x-e.x,y:t.y-e.y}}function oc({point:t},e){return{point:t,delta:If(t,by(e)),offset:If(t,tS(e)),velocity:nS(e,.1)}}function tS(t){return t[0]}function by(t){return t[t.length-1]}function nS(t,e){if(t.length<2)return{x:0,y:0};let n=t.length-1,r=null;const s=by(t);for(;n>=0&&(r=t[n],!(s.timestamp-r.timestamp>st(e)));)n--;if(!r)return{x:0,y:0};r===t[0]&&t.length>2&&s.timestamp-r.timestamp>st(e)*2&&(r=t[1]);const i=ct(s.timestamp-r.timestamp);if(i===0)return{x:0,y:0};const o={x:(s.x-r.x)/i,y:(s.y-r.y)/i};return o.x===1/0&&(o.x=0),o.y===1/0&&(o.y=0),o}function rS(t,{min:e,max:n},r){return e!==void 0&&t<e?t=r?he(e,t,r.min):Math.max(t,e):n!==void 0&&t>n&&(t=r?he(n,t,r.max):Math.min(t,n)),t}function bf(t,e,n){return{min:e!==void 0?t.min+e:void 0,max:n!==void 0?t.max+n-(t.max-t.min):void 0}}function sS(t,{top:e,left:n,bottom:r,right:s}){return{x:bf(t.x,n,s),y:bf(t.y,e,r)}}function Af(t,e){let n=e.min-t.min,r=e.max-t.max;return e.max-e.min<t.max-t.min&&([n,r]=[r,n]),{min:n,max:r}}function iS(t,e){return{x:Af(t.x,e.x),y:Af(t.y,e.y)}}function oS(t,e){let n=.5;const r=Qe(t),s=Qe(e);return s>r?n=js(e.min,e.max-r,t.min):r>s&&(n=js(t.min,t.max-s,e.min)),Vt(0,1,n)}function aS(t,e){const n={};return e.min!==void 0&&(n.min=e.min-t.min),e.max!==void 0&&(n.max=e.max-t.min),n}const Xc=.35;function cS(t=Xc){return t===!1?t=0:t===!0&&(t=Xc),{x:Rf(t,"left","right"),y:Rf(t,"top","bottom")}}function Rf(t,e,n){return{min:Sf(t,e),max:Sf(t,n)}}function Sf(t,e){return typeof t=="number"?t:t[e]||0}const lS=new WeakMap;class uS{constructor(e){this.openDragLock=null,this.isDragging=!1,this.currentDirection=null,this.originPoint={x:0,y:0},this.constraints=!1,this.hasMutatedConstraints=!1,this.elastic=Ve(),this.latestPointerEvent=null,this.latestPanInfo=null,this.visualElement=e}start(e,{snapToCursor:n=!1,distanceThreshold:r}={}){const{presenceContext:s}=this.visualElement;if(s&&s.isPresent===!1)return;const i=f=>{n&&this.snapToCursor(ai(f).point),this.stopAnimation()},o=(f,m)=>{const{drag:y,dragPropagation:w,onDragStart:R}=this.getProps();if(y&&!w&&(this.openDragLock&&this.openDragLock(),this.openDragLock=Lb(y),!this.openDragLock))return;this.latestPointerEvent=f,this.latestPanInfo=m,this.isDragging=!0,this.currentDirection=null,this.resolveConstraints(),this.visualElement.projection&&(this.visualElement.projection.isAnimationBlocked=!0,this.visualElement.projection.target=void 0),It(P=>{let x=this.getAxisMotionValue(P).get()||0;if(St.test(x)){const{projection:V}=this.visualElement;if(V&&V.layout){const L=V.layout.layoutBox[P];L&&(x=Qe(L)*(parseFloat(x)/100))}}this.originPoint[P]=x}),R&&ae.update(()=>R(f,m),!1,!0),$c(this.visualElement,"transform");const{animationState:I}=this.visualElement;I&&I.setActive("whileDrag",!0)},c=(f,m)=>{this.latestPointerEvent=f,this.latestPanInfo=m;const{dragPropagation:y,dragDirectionLock:w,onDirectionLock:R,onDrag:I}=this.getProps();if(!y&&!this.openDragLock)return;const{offset:P}=m;if(w&&this.currentDirection===null){this.currentDirection=dS(P),this.currentDirection!==null&&R&&R(this.currentDirection);return}this.updateAxis("x",m.point,P),this.updateAxis("y",m.point,P),this.visualElement.render(),I&&ae.update(()=>I(f,m),!1,!0)},l=(f,m)=>{this.latestPointerEvent=f,this.latestPanInfo=m,this.stop(f,m),this.latestPointerEvent=null,this.latestPanInfo=null},u=()=>{const{dragSnapToOrigin:f}=this.getProps();(f||this.constraints)&&this.startAnimation({x:0,y:0})},{dragSnapToOrigin:h}=this.getProps();this.panSession=new Iy(e,{onSessionStart:i,onStart:o,onMove:c,onSessionEnd:l,resumeAnimation:u},{transformPagePoint:this.visualElement.getTransformPagePoint(),dragSnapToOrigin:h,distanceThreshold:r,contextWindow:Ey(this.visualElement),element:this.visualElement.current})}stop(e,n){const r=e||this.latestPointerEvent,s=n||this.latestPanInfo,i=this.isDragging;if(this.cancel(),!i||!s||!r)return;const{velocity:o}=s;this.startAnimation(o);const{onDragEnd:c}=this.getProps();c&&ae.postRender(()=>c(r,s))}cancel(){this.isDragging=!1;const{projection:e,animationState:n}=this.visualElement;e&&(e.isAnimationBlocked=!1),this.endPanSession();const{dragPropagation:r}=this.getProps();!r&&this.openDragLock&&(this.openDragLock(),this.openDragLock=null),n&&n.setActive("whileDrag",!1)}endPanSession(){this.panSession&&this.panSession.end(),this.panSession=void 0}updateAxis(e,n,r){const{drag:s}=this.getProps();if(!r||!Bi(e,s,this.currentDirection))return;const i=this.getAxisMotionValue(e);let o=this.originPoint[e]+r[e];this.constraints&&this.constraints[e]&&(o=rS(o,this.constraints[e],this.elastic[e])),i.set(o)}resolveConstraints(){var i;const{dragConstraints:e,dragElastic:n}=this.getProps(),r=this.visualElement.projection&&!this.visualElement.projection.layout?this.visualElement.projection.measure(!1):(i=this.visualElement.projection)==null?void 0:i.layout,s=this.constraints;e&&_r(e)?this.constraints||(this.constraints=this.resolveRefConstraints()):e&&r?this.constraints=sS(r.layoutBox,e):this.constraints=!1,this.elastic=cS(n),s!==this.constraints&&!_r(e)&&r&&this.constraints&&!this.hasMutatedConstraints&&It(o=>{this.constraints!==!1&&this.getAxisMotionValue(o)&&(this.constraints[o]=aS(r.layoutBox[o],this.constraints[o]))})}resolveRefConstraints(){const{dragConstraints:e,onMeasureDragConstraints:n}=this.getProps();if(!e||!_r(e))return!1;const r=e.current,{projection:s}=this.visualElement;if(!s||!s.layout)return!1;const i=dA(r,s.root,this.visualElement.getTransformPagePoint());let o=iS(s.layout.layoutBox,i);if(n){const c=n(lA(o));this.hasMutatedConstraints=!!c,c&&(o=Wg(c))}return o}startAnimation(e){const{drag:n,dragMomentum:r,dragElastic:s,dragTransition:i,dragSnapToOrigin:o,onDragTransitionEnd:c}=this.getProps(),l=this.constraints||{},u=It(h=>{if(!Bi(h,n,this.currentDirection))return;let f=l&&l[h]||{};(o===!0||o===h)&&(f={min:0,max:0});const m=s?200:1e6,y=s?40:1e7,w={type:"inertia",velocity:r?e[h]:0,bounceStiffness:m,bounceDamping:y,timeConstant:750,restDelta:1,restSpeed:10,...i,...f};return this.startAxisValueAnimation(h,w)});return Promise.all(u).then(c)}startAxisValueAnimation(e,n){const r=this.getAxisMotionValue(e);return $c(this.visualElement,e),r.start(Ql(e,r,0,n,this.visualElement,!1))}stopAnimation(){It(e=>this.getAxisMotionValue(e).stop())}getAxisMotionValue(e){const n=`_drag${e.toUpperCase()}`,r=this.visualElement.getProps(),s=r[n];return s||this.visualElement.getValue(e,(r.initial?r.initial[e]:void 0)||0)}snapToCursor(e){It(n=>{const{drag:r}=this.getProps();if(!Bi(n,r,this.currentDirection))return;const{projection:s}=this.visualElement,i=this.getAxisMotionValue(n);if(s&&s.layout){const{min:o,max:c}=s.layout.layoutBox[n],l=i.get()||0;i.set(e[n]-he(o,c,.5)+l)}})}scalePositionWithinConstraints(){if(!this.visualElement.current)return;const{drag:e,dragConstraints:n}=this.getProps(),{projection:r}=this.visualElement;if(!_r(n)||!r||!this.constraints)return;this.stopAnimation();const s={x:0,y:0};It(o=>{const c=this.getAxisMotionValue(o);if(c&&this.constraints!==!1){const l=c.get();s[o]=oS({min:l,max:l},this.constraints[o])}});const{transformTemplate:i}=this.visualElement.getProps();this.visualElement.current.style.transform=i?i({},""):"none",r.root&&r.root.updateScroll(),r.updateLayout(),this.constraints=!1,this.resolveConstraints(),It(o=>{if(!Bi(o,e,null))return;const c=this.getAxisMotionValue(o),{min:l,max:u}=this.constraints[o];c.set(he(l,u,s[o]))}),this.visualElement.render()}addListeners(){if(!this.visualElement.current)return;lS.set(this.visualElement,this);const e=this.visualElement.current,n=Vs(e,"pointerdown",u=>{const{drag:h,dragListener:f=!0}=this.getProps(),m=u.target,y=m!==e&&$b(m);h&&f&&!y&&this.start(u)});let r;const s=()=>{const{dragConstraints:u}=this.getProps();_r(u)&&u.current&&(this.constraints=this.resolveRefConstraints(),r||(r=hS(e,u.current,()=>this.scalePositionWithinConstraints())))},{projection:i}=this.visualElement,o=i.addEventListener("measure",s);i&&!i.layout&&(i.root&&i.root.updateScroll(),i.updateLayout()),ae.read(s);const c=qs(window,"resize",()=>this.scalePositionWithinConstraints()),l=i.addEventListener("didUpdate",(({delta:u,hasLayoutChanged:h})=>{this.isDragging&&h&&(It(f=>{const m=this.getAxisMotionValue(f);m&&(this.originPoint[f]+=u[f].translate,m.set(m.get()+u[f].translate))}),this.visualElement.render())}));return()=>{c(),n(),o(),l&&l(),r&&r()}}getProps(){const e=this.visualElement.getProps(),{drag:n=!1,dragDirectionLock:r=!1,dragPropagation:s=!1,dragConstraints:i=!1,dragElastic:o=Xc,dragMomentum:c=!0}=e;return{...e,drag:n,dragDirectionLock:r,dragPropagation:s,dragConstraints:i,dragElastic:o,dragMomentum:c}}}function Pf(t){let e=!0;return()=>{if(e){e=!1;return}t()}}function hS(t,e,n){const r=Md(t,Pf(n)),s=Md(e,Pf(n));return()=>{r(),s()}}function Bi(t,e,n){return(e===!0||e===t)&&(n===null||n===t)}function dS(t,e=10){let n=null;return Math.abs(t.y)>e?n="y":Math.abs(t.x)>e&&(n="x"),n}class fS extends Cn{constructor(e){super(e),this.removeGroupControls=ut,this.removeListeners=ut,this.controls=new uS(e)}mount(){const{dragControls:e}=this.node.getProps();e&&(this.removeGroupControls=e.subscribe(this.controls)),this.removeListeners=this.controls.addListeners()||ut}update(){const{dragControls:e}=this.node.getProps(),{dragControls:n}=this.node.prevProps||{};e!==n&&(this.removeGroupControls(),e&&(this.removeGroupControls=e.subscribe(this.controls)))}unmount(){this.removeGroupControls(),this.removeListeners(),this.controls.isDragging||this.controls.endPanSession()}}const ac=t=>(e,n)=>{t&&ae.update(()=>t(e,n),!1,!0)};class pS extends Cn{constructor(){super(...arguments),this.removePointerDownListener=ut}onPointerDown(e){this.session=new Iy(e,this.createPanHandlers(),{transformPagePoint:this.node.getTransformPagePoint(),contextWindow:Ey(this.node)})}createPanHandlers(){const{onPanSessionStart:e,onPanStart:n,onPan:r,onPanEnd:s}=this.node.getProps();return{onSessionStart:ac(e),onStart:ac(n),onMove:ac(r),onEnd:(i,o)=>{delete this.session,s&&ae.postRender(()=>s(i,o))}}}mount(){this.removePointerDownListener=Vs(this.node.current,"pointerdown",e=>this.onPointerDown(e))}update(){this.session&&this.session.updateHandlers(this.createPanHandlers())}unmount(){this.removePointerDownListener(),this.session&&this.session.end()}}let cc=!1;class mS extends S.Component{componentDidMount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:r,layoutId:s}=this.props,{projection:i}=e;i&&(n.group&&n.group.add(i),r&&r.register&&s&&r.register(i),cc&&i.root.didUpdate(),i.addEventListener("animationComplete",()=>{this.safeToRemove()}),i.setOptions({...i.options,layoutDependency:this.props.layoutDependency,onExitComplete:()=>this.safeToRemove()})),io.hasEverUpdated=!0}getSnapshotBeforeUpdate(e){const{layoutDependency:n,visualElement:r,drag:s,isPresent:i}=this.props,{projection:o}=r;return o&&(o.isPresent=i,e.layoutDependency!==n&&o.setOptions({...o.options,layoutDependency:n}),cc=!0,s||e.layoutDependency!==n||n===void 0||e.isPresent!==i?o.willUpdate():this.safeToRemove(),e.isPresent!==i&&(i?o.promote():o.relegate()||ae.postRender(()=>{const c=o.getStack();(!c||!c.members.length)&&this.safeToRemove()}))),null}componentDidUpdate(){const{visualElement:e,layoutAnchor:n}=this.props,{projection:r}=e;r&&(r.options.layoutAnchor=n,r.root.didUpdate(),eu.postRender(()=>{!r.currentAnimation&&r.isLead()&&this.safeToRemove()}))}componentWillUnmount(){const{visualElement:e,layoutGroup:n,switchLayoutGroup:r}=this.props,{projection:s}=e;cc=!0,s&&(s.scheduleCheckAfterUnmount(),n&&n.group&&n.group.remove(s),r&&r.deregister&&r.deregister(s))}safeToRemove(){const{safeToRemove:e}=this.props;e&&e()}render(){return null}}function Ay(t){const[e,n]=fy(),r=S.useContext(Nl);return lt.jsx(mS,{...t,layoutGroup:r,switchLayoutGroup:S.useContext(wy),isPresent:e,safeToRemove:n})}const gS={pan:{Feature:pS},drag:{Feature:fS,ProjectionNode:dy,MeasureLayout:Ay}};function Cf(t,e,n){const{props:r}=t;t.animationState&&r.whileHover&&t.animationState.setActive("whileHover",n==="Start");const s="onHover"+n,i=r[s];i&&ae.postRender(()=>i(e,ai(e)))}class yS extends Cn{mount(){const{current:e}=this.node;e&&(this.unmount=Fb(e,(n,r)=>(Cf(this.node,r,"Start"),s=>Cf(this.node,s,"End"))))}unmount(){}}class _S extends Cn{constructor(){super(...arguments),this.isActive=!1}onFocus(){let e=!1;try{e=this.node.current.matches(":focus-visible")}catch{e=!0}!e||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!0),this.isActive=!0)}onBlur(){!this.isActive||!this.node.animationState||(this.node.animationState.setActive("whileFocus",!1),this.isActive=!1)}mount(){this.unmount=si(qs(this.node.current,"focus",()=>this.onFocus()),qs(this.node.current,"blur",()=>this.onBlur()))}unmount(){}}function kf(t,e,n){const{props:r}=t;if(t.current instanceof HTMLButtonElement&&t.current.disabled)return;t.animationState&&r.whileTap&&t.animationState.setActive("whileTap",n==="Start");const s="onTap"+(n==="End"?"":n),i=r[s];i&&ae.postRender(()=>i(e,ai(e)))}class vS extends Cn{mount(){const{current:e}=this.node;if(!e)return;const{globalTapTarget:n,propagate:r}=this.node.props;this.unmount=qb(e,(s,i)=>(kf(this.node,i,"Start"),(o,{success:c})=>kf(this.node,o,c?"End":"Cancel")),{useGlobalTarget:n,stopPropagation:(r==null?void 0:r.tap)===!1})}unmount(){}}const Jc=new WeakMap,lc=new WeakMap,wS=t=>{const e=Jc.get(t.target);e&&e(t)},TS=t=>{t.forEach(wS)};function ES({root:t,...e}){const n=t||document;lc.has(n)||lc.set(n,{});const r=lc.get(n),s=JSON.stringify(e);return r[s]||(r[s]=new IntersectionObserver(TS,{root:t,...e})),r[s]}function IS(t,e,n){const r=ES(e);return Jc.set(t,n),r.observe(t),()=>{Jc.delete(t),r.unobserve(t)}}const bS={some:0,all:1};class AS extends Cn{constructor(){super(...arguments),this.hasEnteredView=!1,this.isInView=!1}startObserver(){var l;(l=this.stopObserver)==null||l.call(this);const{viewport:e={}}=this.node.getProps(),{root:n,margin:r,amount:s="some",once:i}=e,o={root:n?n.current:void 0,rootMargin:r,threshold:typeof s=="number"?s:bS[s]},c=u=>{const{isIntersecting:h}=u;if(this.isInView===h||(this.isInView=h,i&&!h&&this.hasEnteredView))return;h&&(this.hasEnteredView=!0),this.node.animationState&&this.node.animationState.setActive("whileInView",h);const{onViewportEnter:f,onViewportLeave:m}=this.node.getProps(),y=h?f:m;y&&y(u)};this.stopObserver=IS(this.node.current,o,c)}mount(){this.startObserver()}update(){if(typeof IntersectionObserver>"u")return;const{props:e,prevProps:n}=this.node;["amount","margin","root"].some(RS(e,n))&&this.startObserver()}unmount(){var e;(e=this.stopObserver)==null||e.call(this),this.hasEnteredView=!1,this.isInView=!1}}function RS({viewport:t={}},{viewport:e={}}={}){return n=>t[n]!==e[n]}const SS={inView:{Feature:AS},tap:{Feature:vS},focus:{Feature:_S},hover:{Feature:yS}},PS={layout:{ProjectionNode:dy,MeasureLayout:Ay}},CS={...JR,...SS,...gS,...PS},Ry=GR(CS,KR);function Sy(t){const e=Pn(()=>tr(t)),{isStatic:n}=S.useContext(ta);if(n){const[,r]=S.useState(t);S.useEffect(()=>e.on("change",r),[])}return e}function Py(t,e){const n=Sy(e()),r=()=>n.set(e());return r(),Ll(()=>{const s=()=>ae.preRender(r,!1,!0),i=t.map(o=>o.on("change",s));return()=>{i.forEach(o=>o()),qt(r)}}),n}function kS(t){ks.current=[],t();const e=Py(ks.current,t);return ks.current=void 0,e}function xS(t,e,n,r){if(typeof t=="function")return kS(t);const i=typeof e=="function"?e:eA(e,n,r),o=Array.isArray(t)?xf(t,i):xf([t],([l])=>i(l)),c=Array.isArray(t)?void 0:t.accelerate;return c&&!c.isTransformed&&typeof e!="function"&&Array.isArray(n)&&(r==null?void 0:r.clamp)!==!1&&(o.accelerate={...c,times:e,keyframes:n,isTransformed:!0}),o}function xf(t,e){const n=Pn(()=>[]);return Py(t,()=>{n.length=0;const r=t.length;for(let s=0;s<r;s++)n[s]=t[s].get();return e(n)})}class VS{constructor(){this.componentControls=new Set}subscribe(e){return this.componentControls.add(e),()=>this.componentControls.delete(e)}start(e,n){this.componentControls.forEach(r=>{r.start(e.nativeEvent||e,n)})}cancel(){this.componentControls.forEach(e=>{e.cancel()})}stop(){this.componentControls.forEach(e=>{e.stop()})}}const DS=()=>new VS;function sN(){return Pn(DS)}const Cy=S.createContext(null);function MS(t,e,n,r){if(!r)return t;const s=t.findIndex(h=>h.value===e);if(s===-1)return t;const i=r>0?1:-1,o=t[s+i];if(!o)return t;const c=t[s],l=o.layout,u=he(l.min,l.max,.5);return i===1&&c.layout.max+n>u||i===-1&&c.layout.min+n<u?V0(t,s,s+i):t}function NS({children:t,as:e="ul",axis:n="y",onReorder:r,values:s,...i},o){const c=Pn(()=>Ry[e]),l=[],u=S.useRef(!1),h=S.useRef(null),f={axis:n,groupRef:h,registerItem:(w,R)=>{const I=l.findIndex(P=>w===P.value);I!==-1?l[I].layout=R[n]:l.push({value:w,layout:R[n]}),l.sort(LS)},updateOrder:(w,R,I)=>{if(u.current)return;const P=MS(l,w,R,I);if(l!==P){u.current=!0;const x=[...s];for(let V=0;V<P.length;V++)if(l[V].value!==P[V].value){const L=s.indexOf(l[V].value),O=s.indexOf(P[V].value);L!==-1&&O!==-1&&([x[L],x[O]]=[x[O],x[L]]);break}r(x)}}};S.useEffect(()=>{u.current=!1});const m=w=>{h.current=w,typeof o=="function"?o(w):o&&(o.current=w)},y={overflowAnchor:"none",...i.style};return lt.jsx(c,{...i,style:y,ref:m,ignoreStrict:!0,children:lt.jsx(Cy.Provider,{value:f,children:t})})}const iN=S.forwardRef(NS);function LS(t,e){return t.layout.min-e.layout.min}const ji=50,Vf=25,OS=new Set(["auto","scroll"]),Ds=new WeakMap,Ms=new WeakMap;let Is=null;function FS(){if(Is){const t=Zc(Is,"y");t&&(Ms.delete(t),Ds.delete(t));const e=Zc(Is,"x");e&&e!==t&&(Ms.delete(e),Ds.delete(e)),Is=null}}function US(t,e){const n=getComputedStyle(t),r=e==="x"?n.overflowX:n.overflowY,s=t===document.body||t===document.documentElement;return OS.has(r)||s}function Zc(t,e){let n=t==null?void 0:t.parentElement;for(;n;){if(US(n,e))return n;n=n.parentElement}return null}function BS(t,e,n){const r=e.getBoundingClientRect(),s=n==="x"?Math.max(0,r.left):Math.max(0,r.top),i=n==="x"?Math.min(window.innerWidth,r.right):Math.min(window.innerHeight,r.bottom),o=t-s,c=i-t;if(o<ji){const l=1-o/ji;return{amount:-Vf*l*l,edge:"start"}}else if(c<ji){const l=1-c/ji;return{amount:Vf*l*l,edge:"end"}}return{amount:0,edge:null}}function jS(t,e,n,r){if(!t)return;Is=t;const s=Zc(t,n);if(!s)return;const i=e-(n==="x"?window.scrollX:window.scrollY),{amount:o,edge:c}=BS(i,s,n);if(c===null){Ms.delete(s),Ds.delete(s);return}const l=Ms.get(s),u=s===document.body||s===document.documentElement;if(l!==c){if(!(c==="start"&&r<0||c==="end"&&r>0))return;Ms.set(s,c);const f=n==="x"?s.scrollWidth-(u?window.innerWidth:s.clientWidth):s.scrollHeight-(u?window.innerHeight:s.clientHeight);Ds.set(s,f)}if(o>0){const h=Ds.get(s);if((n==="x"?u?window.scrollX:s.scrollLeft:u?window.scrollY:s.scrollTop)>=h)return}n==="x"?u?window.scrollBy({left:o}):s.scrollLeft+=o:u?window.scrollBy({top:o}):s.scrollTop+=o}function Df(t,e=0){return Le(t)?t:Sy(e)}function $S({children:t,style:e={},value:n,as:r="li",onDrag:s,onDragEnd:i,layout:o=!0,...c},l){const u=Pn(()=>Ry[r]),h=S.useContext(Cy),f={x:Df(e.x),y:Df(e.y)},m=xS([f.x,f.y],([P,x])=>P||x?1:"unset"),{axis:y,registerItem:w,updateOrder:R,groupRef:I}=h;return lt.jsx(u,{drag:y,...c,dragSnapToOrigin:!0,style:{...e,x:f.x,y:f.y,zIndex:m},layout:o,onDrag:(P,x)=>{const{velocity:V,point:L}=x,O=f[y].get();R(n,O,V[y]),jS(I.current,L[y],y,V[y]),s&&s(P,x)},onDragEnd:(P,x)=>{FS(),i&&i(P,x)},onLayoutMeasure:P=>{w(n,P)},ref:l,ignoreStrict:!0,children:t})}const oN=S.forwardRef($S),zS=(t,e)=>{const n=new Array(t.length+e.length);for(let r=0;r<t.length;r++)n[r]=t[r];for(let r=0;r<e.length;r++)n[t.length+r]=e[r];return n},qS=(t,e)=>({classGroupId:t,validator:e}),ky=(t=new Map,e=null,n)=>({nextPart:t,validators:e,classGroupId:n}),So="-",Mf=[],WS="arbitrary..",HS=t=>{const e=KS(t),{conflictingClassGroups:n,conflictingClassGroupModifiers:r}=t;return{getClassGroupId:o=>{if(o.startsWith("[")&&o.endsWith("]"))return GS(o);const c=o.split(So),l=c[0]===""&&c.length>1?1:0;return xy(c,l,e)},getConflictingClassGroupIds:(o,c)=>{if(c){const l=r[o],u=n[o];return l?u?zS(u,l):l:u||Mf}return n[o]||Mf}}},xy=(t,e,n)=>{if(t.length-e===0)return n.classGroupId;const s=t[e],i=n.nextPart.get(s);if(i){const u=xy(t,e+1,i);if(u)return u}const o=n.validators;if(o===null)return;const c=e===0?t.join(So):t.slice(e).join(So),l=o.length;for(let u=0;u<l;u++){const h=o[u];if(h.validator(c))return h.classGroupId}},GS=t=>t.slice(1,-1).indexOf(":")===-1?void 0:(()=>{const e=t.slice(1,-1),n=e.indexOf(":"),r=e.slice(0,n);return r?WS+r:void 0})(),KS=t=>{const{theme:e,classGroups:n}=t;return YS(n,e)},YS=(t,e)=>{const n=ky();for(const r in t){const s=t[r];lu(s,n,r,e)}return n},lu=(t,e,n,r)=>{const s=t.length;for(let i=0;i<s;i++){const o=t[i];QS(o,e,n,r)}},QS=(t,e,n,r)=>{if(typeof t=="string"){XS(t,e,n);return}if(typeof t=="function"){JS(t,e,n,r);return}ZS(t,e,n,r)},XS=(t,e,n)=>{const r=t===""?e:Vy(e,t);r.classGroupId=n},JS=(t,e,n,r)=>{if(eP(t)){lu(t(r),e,n,r);return}e.validators===null&&(e.validators=[]),e.validators.push(qS(n,t))},ZS=(t,e,n,r)=>{const s=Object.entries(t),i=s.length;for(let o=0;o<i;o++){const[c,l]=s[o];lu(l,Vy(e,c),n,r)}},Vy=(t,e)=>{let n=t;const r=e.split(So),s=r.length;for(let i=0;i<s;i++){const o=r[i];let c=n.nextPart.get(o);c||(c=ky(),n.nextPart.set(o,c)),n=c}return n},eP=t=>"isThemeGetter"in t&&t.isThemeGetter===!0,tP=t=>{if(t<1)return{get:()=>{},set:()=>{}};let e=0,n=Object.create(null),r=Object.create(null);const s=(i,o)=>{n[i]=o,e++,e>t&&(e=0,r=n,n=Object.create(null))};return{get(i){let o=n[i];if(o!==void 0)return o;if((o=r[i])!==void 0)return s(i,o),o},set(i,o){i in n?n[i]=o:s(i,o)}}},el="!",Nf=":",nP=[],Lf=(t,e,n,r,s)=>({modifiers:t,hasImportantModifier:e,baseClassName:n,maybePostfixModifierPosition:r,isExternal:s}),rP=t=>{const{prefix:e,experimentalParseClassName:n}=t;let r=s=>{const i=[];let o=0,c=0,l=0,u;const h=s.length;for(let R=0;R<h;R++){const I=s[R];if(o===0&&c===0){if(I===Nf){i.push(s.slice(l,R)),l=R+1;continue}if(I==="/"){u=R;continue}}I==="["?o++:I==="]"?o--:I==="("?c++:I===")"&&c--}const f=i.length===0?s:s.slice(l);let m=f,y=!1;f.endsWith(el)?(m=f.slice(0,-1),y=!0):f.startsWith(el)&&(m=f.slice(1),y=!0);const w=u&&u>l?u-l:void 0;return Lf(i,y,m,w)};if(e){const s=e+Nf,i=r;r=o=>o.startsWith(s)?i(o.slice(s.length)):Lf(nP,!1,o,void 0,!0)}if(n){const s=r;r=i=>n({className:i,parseClassName:s})}return r},sP=t=>{const e=new Map;return t.orderSensitiveModifiers.forEach((n,r)=>{e.set(n,1e6+r)}),n=>{const r=[];let s=[];for(let i=0;i<n.length;i++){const o=n[i],c=o[0]==="[",l=e.has(o);c||l?(s.length>0&&(s.sort(),r.push(...s),s=[]),r.push(o)):s.push(o)}return s.length>0&&(s.sort(),r.push(...s)),r}},iP=t=>({cache:tP(t.cacheSize),parseClassName:rP(t),sortModifiers:sP(t),...HS(t)}),oP=/\s+/,aP=(t,e)=>{const{parseClassName:n,getClassGroupId:r,getConflictingClassGroupIds:s,sortModifiers:i}=e,o=[],c=t.trim().split(oP);let l="";for(let u=c.length-1;u>=0;u-=1){const h=c[u],{isExternal:f,modifiers:m,hasImportantModifier:y,baseClassName:w,maybePostfixModifierPosition:R}=n(h);if(f){l=h+(l.length>0?" "+l:l);continue}let I=!!R,P=r(I?w.substring(0,R):w);if(!P){if(!I){l=h+(l.length>0?" "+l:l);continue}if(P=r(w),!P){l=h+(l.length>0?" "+l:l);continue}I=!1}const x=m.length===0?"":m.length===1?m[0]:i(m).join(":"),V=y?x+el:x,L=V+P;if(o.indexOf(L)>-1)continue;o.push(L);const O=s(P,I);for(let z=0;z<O.length;++z){const b=O[z];o.push(V+b)}l=h+(l.length>0?" "+l:l)}return l},cP=(...t)=>{let e=0,n,r,s="";for(;e<t.length;)(n=t[e++])&&(r=Dy(n))&&(s&&(s+=" "),s+=r);return s},Dy=t=>{if(typeof t=="string")return t;let e,n="";for(let r=0;r<t.length;r++)t[r]&&(e=Dy(t[r]))&&(n&&(n+=" "),n+=e);return n},lP=(t,...e)=>{let n,r,s,i;const o=l=>{const u=e.reduce((h,f)=>f(h),t());return n=iP(u),r=n.cache.get,s=n.cache.set,i=c,c(l)},c=l=>{const u=r(l);if(u)return u;const h=aP(l,n);return s(l,h),h};return i=o,(...l)=>i(cP(...l))},uP=[],xe=t=>{const e=n=>n[t]||uP;return e.isThemeGetter=!0,e},My=/^\[(?:(\w[\w-]*):)?(.+)\]$/i,Ny=/^\((?:(\w[\w-]*):)?(.+)\)$/i,hP=/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,dP=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,fP=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,pP=/^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,mP=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,gP=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,rn=t=>hP.test(t),Z=t=>!!t&&!Number.isNaN(Number(t)),sn=t=>!!t&&Number.isInteger(Number(t)),uc=t=>t.endsWith("%")&&Z(t.slice(0,-1)),Ft=t=>dP.test(t),Ly=()=>!0,yP=t=>fP.test(t)&&!pP.test(t),uu=()=>!1,_P=t=>mP.test(t),vP=t=>gP.test(t),wP=t=>!j(t)&&!q(t),TP=t=>kn(t,Uy,uu),j=t=>My.test(t),qn=t=>kn(t,By,yP),Of=t=>kn(t,CP,Z),EP=t=>kn(t,$y,Ly),IP=t=>kn(t,jy,uu),Ff=t=>kn(t,Oy,uu),bP=t=>kn(t,Fy,vP),$i=t=>kn(t,zy,_P),q=t=>Ny.test(t),vs=t=>lr(t,By),AP=t=>lr(t,jy),Uf=t=>lr(t,Oy),RP=t=>lr(t,Uy),SP=t=>lr(t,Fy),zi=t=>lr(t,zy,!0),PP=t=>lr(t,$y,!0),kn=(t,e,n)=>{const r=My.exec(t);return r?r[1]?e(r[1]):n(r[2]):!1},lr=(t,e,n=!1)=>{const r=Ny.exec(t);return r?r[1]?e(r[1]):n:!1},Oy=t=>t==="position"||t==="percentage",Fy=t=>t==="image"||t==="url",Uy=t=>t==="length"||t==="size"||t==="bg-size",By=t=>t==="length",CP=t=>t==="number",jy=t=>t==="family-name",$y=t=>t==="number"||t==="weight",zy=t=>t==="shadow",kP=()=>{const t=xe("color"),e=xe("font"),n=xe("text"),r=xe("font-weight"),s=xe("tracking"),i=xe("leading"),o=xe("breakpoint"),c=xe("container"),l=xe("spacing"),u=xe("radius"),h=xe("shadow"),f=xe("inset-shadow"),m=xe("text-shadow"),y=xe("drop-shadow"),w=xe("blur"),R=xe("perspective"),I=xe("aspect"),P=xe("ease"),x=xe("animate"),V=()=>["auto","avoid","all","avoid-page","page","left","right","column"],L=()=>["center","top","bottom","left","right","top-left","left-top","top-right","right-top","bottom-right","right-bottom","bottom-left","left-bottom"],O=()=>[...L(),q,j],z=()=>["auto","hidden","clip","visible","scroll"],b=()=>["auto","contain","none"],g=()=>[q,j,l],v=()=>[rn,"full","auto",...g()],E=()=>[sn,"none","subgrid",q,j],A=()=>["auto",{span:["full",sn,q,j]},sn,q,j],C=()=>[sn,"auto",q,j],T=()=>["auto","min","max","fr",q,j],ie=()=>["start","end","center","between","around","evenly","stretch","baseline","center-safe","end-safe"],se=()=>["start","end","center","stretch","center-safe","end-safe"],pe=()=>["auto",...g()],wt=()=>[rn,"auto","full","dvw","dvh","lvw","lvh","svw","svh","min","max","fit",...g()],le=()=>[rn,"screen","full","dvw","lvw","svw","min","max","fit",...g()],Te=()=>[rn,"screen","full","lh","dvh","lvh","svh","min","max","fit",...g()],H=()=>[t,q,j],ot=()=>[...L(),Uf,Ff,{position:[q,j]}],Mn=()=>["no-repeat",{repeat:["","x","y","space","round"]}],es=()=>["auto","cover","contain",RP,TP,{size:[q,j]}],Yt=()=>[uc,vs,qn],Pe=()=>["","none","full",u,q,j],Ce=()=>["",Z,vs,qn],Qt=()=>["solid","dashed","dotted","double"],fr=()=>["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],Ee=()=>[Z,uc,Uf,Ff],Ei=()=>["","none",w,q,j],pr=()=>["none",Z,q,j],Nn=()=>["none",Z,q,j],Ln=()=>[Z,q,j],On=()=>[rn,"full",...g()];return{cacheSize:500,theme:{animate:["spin","ping","pulse","bounce"],aspect:["video"],blur:[Ft],breakpoint:[Ft],color:[Ly],container:[Ft],"drop-shadow":[Ft],ease:["in","out","in-out"],font:[wP],"font-weight":["thin","extralight","light","normal","medium","semibold","bold","extrabold","black"],"inset-shadow":[Ft],leading:["none","tight","snug","normal","relaxed","loose"],perspective:["dramatic","near","normal","midrange","distant","none"],radius:[Ft],shadow:[Ft],spacing:["px",Z],text:[Ft],"text-shadow":[Ft],tracking:["tighter","tight","normal","wide","wider","widest"]},classGroups:{aspect:[{aspect:["auto","square",rn,j,q,I]}],container:["container"],columns:[{columns:[Z,j,q,c]}],"break-after":[{"break-after":V()}],"break-before":[{"break-before":V()}],"break-inside":[{"break-inside":["auto","avoid","avoid-page","avoid-column"]}],"box-decoration":[{"box-decoration":["slice","clone"]}],box:[{box:["border","content"]}],display:["block","inline-block","inline","flex","inline-flex","table","inline-table","table-caption","table-cell","table-column","table-column-group","table-footer-group","table-header-group","table-row-group","table-row","flow-root","grid","inline-grid","contents","list-item","hidden"],sr:["sr-only","not-sr-only"],float:[{float:["right","left","none","start","end"]}],clear:[{clear:["left","right","both","none","start","end"]}],isolation:["isolate","isolation-auto"],"object-fit":[{object:["contain","cover","fill","none","scale-down"]}],"object-position":[{object:O()}],overflow:[{overflow:z()}],"overflow-x":[{"overflow-x":z()}],"overflow-y":[{"overflow-y":z()}],overscroll:[{overscroll:b()}],"overscroll-x":[{"overscroll-x":b()}],"overscroll-y":[{"overscroll-y":b()}],position:["static","fixed","absolute","relative","sticky"],inset:[{inset:v()}],"inset-x":[{"inset-x":v()}],"inset-y":[{"inset-y":v()}],start:[{"inset-s":v(),start:v()}],end:[{"inset-e":v(),end:v()}],"inset-bs":[{"inset-bs":v()}],"inset-be":[{"inset-be":v()}],top:[{top:v()}],right:[{right:v()}],bottom:[{bottom:v()}],left:[{left:v()}],visibility:["visible","invisible","collapse"],z:[{z:[sn,"auto",q,j]}],basis:[{basis:[rn,"full","auto",c,...g()]}],"flex-direction":[{flex:["row","row-reverse","col","col-reverse"]}],"flex-wrap":[{flex:["nowrap","wrap","wrap-reverse"]}],flex:[{flex:[Z,rn,"auto","initial","none",j]}],grow:[{grow:["",Z,q,j]}],shrink:[{shrink:["",Z,q,j]}],order:[{order:[sn,"first","last","none",q,j]}],"grid-cols":[{"grid-cols":E()}],"col-start-end":[{col:A()}],"col-start":[{"col-start":C()}],"col-end":[{"col-end":C()}],"grid-rows":[{"grid-rows":E()}],"row-start-end":[{row:A()}],"row-start":[{"row-start":C()}],"row-end":[{"row-end":C()}],"grid-flow":[{"grid-flow":["row","col","dense","row-dense","col-dense"]}],"auto-cols":[{"auto-cols":T()}],"auto-rows":[{"auto-rows":T()}],gap:[{gap:g()}],"gap-x":[{"gap-x":g()}],"gap-y":[{"gap-y":g()}],"justify-content":[{justify:[...ie(),"normal"]}],"justify-items":[{"justify-items":[...se(),"normal"]}],"justify-self":[{"justify-self":["auto",...se()]}],"align-content":[{content:["normal",...ie()]}],"align-items":[{items:[...se(),{baseline:["","last"]}]}],"align-self":[{self:["auto",...se(),{baseline:["","last"]}]}],"place-content":[{"place-content":ie()}],"place-items":[{"place-items":[...se(),"baseline"]}],"place-self":[{"place-self":["auto",...se()]}],p:[{p:g()}],px:[{px:g()}],py:[{py:g()}],ps:[{ps:g()}],pe:[{pe:g()}],pbs:[{pbs:g()}],pbe:[{pbe:g()}],pt:[{pt:g()}],pr:[{pr:g()}],pb:[{pb:g()}],pl:[{pl:g()}],m:[{m:pe()}],mx:[{mx:pe()}],my:[{my:pe()}],ms:[{ms:pe()}],me:[{me:pe()}],mbs:[{mbs:pe()}],mbe:[{mbe:pe()}],mt:[{mt:pe()}],mr:[{mr:pe()}],mb:[{mb:pe()}],ml:[{ml:pe()}],"space-x":[{"space-x":g()}],"space-x-reverse":["space-x-reverse"],"space-y":[{"space-y":g()}],"space-y-reverse":["space-y-reverse"],size:[{size:wt()}],"inline-size":[{inline:["auto",...le()]}],"min-inline-size":[{"min-inline":["auto",...le()]}],"max-inline-size":[{"max-inline":["none",...le()]}],"block-size":[{block:["auto",...Te()]}],"min-block-size":[{"min-block":["auto",...Te()]}],"max-block-size":[{"max-block":["none",...Te()]}],w:[{w:[c,"screen",...wt()]}],"min-w":[{"min-w":[c,"screen","none",...wt()]}],"max-w":[{"max-w":[c,"screen","none","prose",{screen:[o]},...wt()]}],h:[{h:["screen","lh",...wt()]}],"min-h":[{"min-h":["screen","lh","none",...wt()]}],"max-h":[{"max-h":["screen","lh",...wt()]}],"font-size":[{text:["base",n,vs,qn]}],"font-smoothing":["antialiased","subpixel-antialiased"],"font-style":["italic","not-italic"],"font-weight":[{font:[r,PP,EP]}],"font-stretch":[{"font-stretch":["ultra-condensed","extra-condensed","condensed","semi-condensed","normal","semi-expanded","expanded","extra-expanded","ultra-expanded",uc,j]}],"font-family":[{font:[AP,IP,e]}],"font-features":[{"font-features":[j]}],"fvn-normal":["normal-nums"],"fvn-ordinal":["ordinal"],"fvn-slashed-zero":["slashed-zero"],"fvn-figure":["lining-nums","oldstyle-nums"],"fvn-spacing":["proportional-nums","tabular-nums"],"fvn-fraction":["diagonal-fractions","stacked-fractions"],tracking:[{tracking:[s,q,j]}],"line-clamp":[{"line-clamp":[Z,"none",q,Of]}],leading:[{leading:[i,...g()]}],"list-image":[{"list-image":["none",q,j]}],"list-style-position":[{list:["inside","outside"]}],"list-style-type":[{list:["disc","decimal","none",q,j]}],"text-alignment":[{text:["left","center","right","justify","start","end"]}],"placeholder-color":[{placeholder:H()}],"text-color":[{text:H()}],"text-decoration":["underline","overline","line-through","no-underline"],"text-decoration-style":[{decoration:[...Qt(),"wavy"]}],"text-decoration-thickness":[{decoration:[Z,"from-font","auto",q,qn]}],"text-decoration-color":[{decoration:H()}],"underline-offset":[{"underline-offset":[Z,"auto",q,j]}],"text-transform":["uppercase","lowercase","capitalize","normal-case"],"text-overflow":["truncate","text-ellipsis","text-clip"],"text-wrap":[{text:["wrap","nowrap","balance","pretty"]}],indent:[{indent:g()}],"vertical-align":[{align:["baseline","top","middle","bottom","text-top","text-bottom","sub","super",q,j]}],whitespace:[{whitespace:["normal","nowrap","pre","pre-line","pre-wrap","break-spaces"]}],break:[{break:["normal","words","all","keep"]}],wrap:[{wrap:["break-word","anywhere","normal"]}],hyphens:[{hyphens:["none","manual","auto"]}],content:[{content:["none",q,j]}],"bg-attachment":[{bg:["fixed","local","scroll"]}],"bg-clip":[{"bg-clip":["border","padding","content","text"]}],"bg-origin":[{"bg-origin":["border","padding","content"]}],"bg-position":[{bg:ot()}],"bg-repeat":[{bg:Mn()}],"bg-size":[{bg:es()}],"bg-image":[{bg:["none",{linear:[{to:["t","tr","r","br","b","bl","l","tl"]},sn,q,j],radial:["",q,j],conic:[sn,q,j]},SP,bP]}],"bg-color":[{bg:H()}],"gradient-from-pos":[{from:Yt()}],"gradient-via-pos":[{via:Yt()}],"gradient-to-pos":[{to:Yt()}],"gradient-from":[{from:H()}],"gradient-via":[{via:H()}],"gradient-to":[{to:H()}],rounded:[{rounded:Pe()}],"rounded-s":[{"rounded-s":Pe()}],"rounded-e":[{"rounded-e":Pe()}],"rounded-t":[{"rounded-t":Pe()}],"rounded-r":[{"rounded-r":Pe()}],"rounded-b":[{"rounded-b":Pe()}],"rounded-l":[{"rounded-l":Pe()}],"rounded-ss":[{"rounded-ss":Pe()}],"rounded-se":[{"rounded-se":Pe()}],"rounded-ee":[{"rounded-ee":Pe()}],"rounded-es":[{"rounded-es":Pe()}],"rounded-tl":[{"rounded-tl":Pe()}],"rounded-tr":[{"rounded-tr":Pe()}],"rounded-br":[{"rounded-br":Pe()}],"rounded-bl":[{"rounded-bl":Pe()}],"border-w":[{border:Ce()}],"border-w-x":[{"border-x":Ce()}],"border-w-y":[{"border-y":Ce()}],"border-w-s":[{"border-s":Ce()}],"border-w-e":[{"border-e":Ce()}],"border-w-bs":[{"border-bs":Ce()}],"border-w-be":[{"border-be":Ce()}],"border-w-t":[{"border-t":Ce()}],"border-w-r":[{"border-r":Ce()}],"border-w-b":[{"border-b":Ce()}],"border-w-l":[{"border-l":Ce()}],"divide-x":[{"divide-x":Ce()}],"divide-x-reverse":["divide-x-reverse"],"divide-y":[{"divide-y":Ce()}],"divide-y-reverse":["divide-y-reverse"],"border-style":[{border:[...Qt(),"hidden","none"]}],"divide-style":[{divide:[...Qt(),"hidden","none"]}],"border-color":[{border:H()}],"border-color-x":[{"border-x":H()}],"border-color-y":[{"border-y":H()}],"border-color-s":[{"border-s":H()}],"border-color-e":[{"border-e":H()}],"border-color-bs":[{"border-bs":H()}],"border-color-be":[{"border-be":H()}],"border-color-t":[{"border-t":H()}],"border-color-r":[{"border-r":H()}],"border-color-b":[{"border-b":H()}],"border-color-l":[{"border-l":H()}],"divide-color":[{divide:H()}],"outline-style":[{outline:[...Qt(),"none","hidden"]}],"outline-offset":[{"outline-offset":[Z,q,j]}],"outline-w":[{outline:["",Z,vs,qn]}],"outline-color":[{outline:H()}],shadow:[{shadow:["","none",h,zi,$i]}],"shadow-color":[{shadow:H()}],"inset-shadow":[{"inset-shadow":["none",f,zi,$i]}],"inset-shadow-color":[{"inset-shadow":H()}],"ring-w":[{ring:Ce()}],"ring-w-inset":["ring-inset"],"ring-color":[{ring:H()}],"ring-offset-w":[{"ring-offset":[Z,qn]}],"ring-offset-color":[{"ring-offset":H()}],"inset-ring-w":[{"inset-ring":Ce()}],"inset-ring-color":[{"inset-ring":H()}],"text-shadow":[{"text-shadow":["none",m,zi,$i]}],"text-shadow-color":[{"text-shadow":H()}],opacity:[{opacity:[Z,q,j]}],"mix-blend":[{"mix-blend":[...fr(),"plus-darker","plus-lighter"]}],"bg-blend":[{"bg-blend":fr()}],"mask-clip":[{"mask-clip":["border","padding","content","fill","stroke","view"]},"mask-no-clip"],"mask-composite":[{mask:["add","subtract","intersect","exclude"]}],"mask-image-linear-pos":[{"mask-linear":[Z]}],"mask-image-linear-from-pos":[{"mask-linear-from":Ee()}],"mask-image-linear-to-pos":[{"mask-linear-to":Ee()}],"mask-image-linear-from-color":[{"mask-linear-from":H()}],"mask-image-linear-to-color":[{"mask-linear-to":H()}],"mask-image-t-from-pos":[{"mask-t-from":Ee()}],"mask-image-t-to-pos":[{"mask-t-to":Ee()}],"mask-image-t-from-color":[{"mask-t-from":H()}],"mask-image-t-to-color":[{"mask-t-to":H()}],"mask-image-r-from-pos":[{"mask-r-from":Ee()}],"mask-image-r-to-pos":[{"mask-r-to":Ee()}],"mask-image-r-from-color":[{"mask-r-from":H()}],"mask-image-r-to-color":[{"mask-r-to":H()}],"mask-image-b-from-pos":[{"mask-b-from":Ee()}],"mask-image-b-to-pos":[{"mask-b-to":Ee()}],"mask-image-b-from-color":[{"mask-b-from":H()}],"mask-image-b-to-color":[{"mask-b-to":H()}],"mask-image-l-from-pos":[{"mask-l-from":Ee()}],"mask-image-l-to-pos":[{"mask-l-to":Ee()}],"mask-image-l-from-color":[{"mask-l-from":H()}],"mask-image-l-to-color":[{"mask-l-to":H()}],"mask-image-x-from-pos":[{"mask-x-from":Ee()}],"mask-image-x-to-pos":[{"mask-x-to":Ee()}],"mask-image-x-from-color":[{"mask-x-from":H()}],"mask-image-x-to-color":[{"mask-x-to":H()}],"mask-image-y-from-pos":[{"mask-y-from":Ee()}],"mask-image-y-to-pos":[{"mask-y-to":Ee()}],"mask-image-y-from-color":[{"mask-y-from":H()}],"mask-image-y-to-color":[{"mask-y-to":H()}],"mask-image-radial":[{"mask-radial":[q,j]}],"mask-image-radial-from-pos":[{"mask-radial-from":Ee()}],"mask-image-radial-to-pos":[{"mask-radial-to":Ee()}],"mask-image-radial-from-color":[{"mask-radial-from":H()}],"mask-image-radial-to-color":[{"mask-radial-to":H()}],"mask-image-radial-shape":[{"mask-radial":["circle","ellipse"]}],"mask-image-radial-size":[{"mask-radial":[{closest:["side","corner"],farthest:["side","corner"]}]}],"mask-image-radial-pos":[{"mask-radial-at":L()}],"mask-image-conic-pos":[{"mask-conic":[Z]}],"mask-image-conic-from-pos":[{"mask-conic-from":Ee()}],"mask-image-conic-to-pos":[{"mask-conic-to":Ee()}],"mask-image-conic-from-color":[{"mask-conic-from":H()}],"mask-image-conic-to-color":[{"mask-conic-to":H()}],"mask-mode":[{mask:["alpha","luminance","match"]}],"mask-origin":[{"mask-origin":["border","padding","content","fill","stroke","view"]}],"mask-position":[{mask:ot()}],"mask-repeat":[{mask:Mn()}],"mask-size":[{mask:es()}],"mask-type":[{"mask-type":["alpha","luminance"]}],"mask-image":[{mask:["none",q,j]}],filter:[{filter:["","none",q,j]}],blur:[{blur:Ei()}],brightness:[{brightness:[Z,q,j]}],contrast:[{contrast:[Z,q,j]}],"drop-shadow":[{"drop-shadow":["","none",y,zi,$i]}],"drop-shadow-color":[{"drop-shadow":H()}],grayscale:[{grayscale:["",Z,q,j]}],"hue-rotate":[{"hue-rotate":[Z,q,j]}],invert:[{invert:["",Z,q,j]}],saturate:[{saturate:[Z,q,j]}],sepia:[{sepia:["",Z,q,j]}],"backdrop-filter":[{"backdrop-filter":["","none",q,j]}],"backdrop-blur":[{"backdrop-blur":Ei()}],"backdrop-brightness":[{"backdrop-brightness":[Z,q,j]}],"backdrop-contrast":[{"backdrop-contrast":[Z,q,j]}],"backdrop-grayscale":[{"backdrop-grayscale":["",Z,q,j]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[Z,q,j]}],"backdrop-invert":[{"backdrop-invert":["",Z,q,j]}],"backdrop-opacity":[{"backdrop-opacity":[Z,q,j]}],"backdrop-saturate":[{"backdrop-saturate":[Z,q,j]}],"backdrop-sepia":[{"backdrop-sepia":["",Z,q,j]}],"border-collapse":[{border:["collapse","separate"]}],"border-spacing":[{"border-spacing":g()}],"border-spacing-x":[{"border-spacing-x":g()}],"border-spacing-y":[{"border-spacing-y":g()}],"table-layout":[{table:["auto","fixed"]}],caption:[{caption:["top","bottom"]}],transition:[{transition:["","all","colors","opacity","shadow","transform","none",q,j]}],"transition-behavior":[{transition:["normal","discrete"]}],duration:[{duration:[Z,"initial",q,j]}],ease:[{ease:["linear","initial",P,q,j]}],delay:[{delay:[Z,q,j]}],animate:[{animate:["none",x,q,j]}],backface:[{backface:["hidden","visible"]}],perspective:[{perspective:[R,q,j]}],"perspective-origin":[{"perspective-origin":O()}],rotate:[{rotate:pr()}],"rotate-x":[{"rotate-x":pr()}],"rotate-y":[{"rotate-y":pr()}],"rotate-z":[{"rotate-z":pr()}],scale:[{scale:Nn()}],"scale-x":[{"scale-x":Nn()}],"scale-y":[{"scale-y":Nn()}],"scale-z":[{"scale-z":Nn()}],"scale-3d":["scale-3d"],skew:[{skew:Ln()}],"skew-x":[{"skew-x":Ln()}],"skew-y":[{"skew-y":Ln()}],transform:[{transform:[q,j,"","none","gpu","cpu"]}],"transform-origin":[{origin:O()}],"transform-style":[{transform:["3d","flat"]}],translate:[{translate:On()}],"translate-x":[{"translate-x":On()}],"translate-y":[{"translate-y":On()}],"translate-z":[{"translate-z":On()}],"translate-none":["translate-none"],accent:[{accent:H()}],appearance:[{appearance:["none","auto"]}],"caret-color":[{caret:H()}],"color-scheme":[{scheme:["normal","dark","light","light-dark","only-dark","only-light"]}],cursor:[{cursor:["auto","default","pointer","wait","text","move","help","not-allowed","none","context-menu","progress","cell","crosshair","vertical-text","alias","copy","no-drop","grab","grabbing","all-scroll","col-resize","row-resize","n-resize","e-resize","s-resize","w-resize","ne-resize","nw-resize","se-resize","sw-resize","ew-resize","ns-resize","nesw-resize","nwse-resize","zoom-in","zoom-out",q,j]}],"field-sizing":[{"field-sizing":["fixed","content"]}],"pointer-events":[{"pointer-events":["auto","none"]}],resize:[{resize:["none","","y","x"]}],"scroll-behavior":[{scroll:["auto","smooth"]}],"scroll-m":[{"scroll-m":g()}],"scroll-mx":[{"scroll-mx":g()}],"scroll-my":[{"scroll-my":g()}],"scroll-ms":[{"scroll-ms":g()}],"scroll-me":[{"scroll-me":g()}],"scroll-mbs":[{"scroll-mbs":g()}],"scroll-mbe":[{"scroll-mbe":g()}],"scroll-mt":[{"scroll-mt":g()}],"scroll-mr":[{"scroll-mr":g()}],"scroll-mb":[{"scroll-mb":g()}],"scroll-ml":[{"scroll-ml":g()}],"scroll-p":[{"scroll-p":g()}],"scroll-px":[{"scroll-px":g()}],"scroll-py":[{"scroll-py":g()}],"scroll-ps":[{"scroll-ps":g()}],"scroll-pe":[{"scroll-pe":g()}],"scroll-pbs":[{"scroll-pbs":g()}],"scroll-pbe":[{"scroll-pbe":g()}],"scroll-pt":[{"scroll-pt":g()}],"scroll-pr":[{"scroll-pr":g()}],"scroll-pb":[{"scroll-pb":g()}],"scroll-pl":[{"scroll-pl":g()}],"snap-align":[{snap:["start","end","center","align-none"]}],"snap-stop":[{snap:["normal","always"]}],"snap-type":[{snap:["none","x","y","both"]}],"snap-strictness":[{snap:["mandatory","proximity"]}],touch:[{touch:["auto","none","manipulation"]}],"touch-x":[{"touch-pan":["x","left","right"]}],"touch-y":[{"touch-pan":["y","up","down"]}],"touch-pz":["touch-pinch-zoom"],select:[{select:["none","text","all","auto"]}],"will-change":[{"will-change":["auto","scroll","contents","transform",q,j]}],fill:[{fill:["none",...H()]}],"stroke-w":[{stroke:[Z,vs,qn,Of]}],stroke:[{stroke:["none",...H()]}],"forced-color-adjust":[{"forced-color-adjust":["auto","none"]}]},conflictingClassGroups:{overflow:["overflow-x","overflow-y"],overscroll:["overscroll-x","overscroll-y"],inset:["inset-x","inset-y","inset-bs","inset-be","start","end","top","right","bottom","left"],"inset-x":["right","left"],"inset-y":["top","bottom"],flex:["basis","grow","shrink"],gap:["gap-x","gap-y"],p:["px","py","ps","pe","pbs","pbe","pt","pr","pb","pl"],px:["pr","pl"],py:["pt","pb"],m:["mx","my","ms","me","mbs","mbe","mt","mr","mb","ml"],mx:["mr","ml"],my:["mt","mb"],size:["w","h"],"font-size":["leading"],"fvn-normal":["fvn-ordinal","fvn-slashed-zero","fvn-figure","fvn-spacing","fvn-fraction"],"fvn-ordinal":["fvn-normal"],"fvn-slashed-zero":["fvn-normal"],"fvn-figure":["fvn-normal"],"fvn-spacing":["fvn-normal"],"fvn-fraction":["fvn-normal"],"line-clamp":["display","overflow"],rounded:["rounded-s","rounded-e","rounded-t","rounded-r","rounded-b","rounded-l","rounded-ss","rounded-se","rounded-ee","rounded-es","rounded-tl","rounded-tr","rounded-br","rounded-bl"],"rounded-s":["rounded-ss","rounded-es"],"rounded-e":["rounded-se","rounded-ee"],"rounded-t":["rounded-tl","rounded-tr"],"rounded-r":["rounded-tr","rounded-br"],"rounded-b":["rounded-br","rounded-bl"],"rounded-l":["rounded-tl","rounded-bl"],"border-spacing":["border-spacing-x","border-spacing-y"],"border-w":["border-w-x","border-w-y","border-w-s","border-w-e","border-w-bs","border-w-be","border-w-t","border-w-r","border-w-b","border-w-l"],"border-w-x":["border-w-r","border-w-l"],"border-w-y":["border-w-t","border-w-b"],"border-color":["border-color-x","border-color-y","border-color-s","border-color-e","border-color-bs","border-color-be","border-color-t","border-color-r","border-color-b","border-color-l"],"border-color-x":["border-color-r","border-color-l"],"border-color-y":["border-color-t","border-color-b"],translate:["translate-x","translate-y","translate-none"],"translate-none":["translate","translate-x","translate-y","translate-z"],"scroll-m":["scroll-mx","scroll-my","scroll-ms","scroll-me","scroll-mbs","scroll-mbe","scroll-mt","scroll-mr","scroll-mb","scroll-ml"],"scroll-mx":["scroll-mr","scroll-ml"],"scroll-my":["scroll-mt","scroll-mb"],"scroll-p":["scroll-px","scroll-py","scroll-ps","scroll-pe","scroll-pbs","scroll-pbe","scroll-pt","scroll-pr","scroll-pb","scroll-pl"],"scroll-px":["scroll-pr","scroll-pl"],"scroll-py":["scroll-pt","scroll-pb"],touch:["touch-x","touch-y","touch-pz"],"touch-x":["touch"],"touch-y":["touch"],"touch-pz":["touch"]},conflictingClassGroupModifiers:{"font-size":["leading"]},orderSensitiveModifiers:["*","**","after","backdrop","before","details-content","file","first-letter","first-line","marker","placeholder","selection"]}},aN=lP(kP);var ws={exports:{}},hc={},dc,Bf;function xP(){if(Bf)return dc;Bf=1;function t(e,n){typeof n=="boolean"&&(n={forever:n}),this._originalTimeouts=JSON.parse(JSON.stringify(e)),this._timeouts=e,this._options=n||{},this._maxRetryTime=n&&n.maxRetryTime||1/0,this._fn=null,this._errors=[],this._attempts=1,this._operationTimeout=null,this._operationTimeoutCb=null,this._timeout=null,this._operationStart=null,this._timer=null,this._options.forever&&(this._cachedTimeouts=this._timeouts.slice(0))}return dc=t,t.prototype.reset=function(){this._attempts=1,this._timeouts=this._originalTimeouts.slice(0)},t.prototype.stop=function(){this._timeout&&clearTimeout(this._timeout),this._timer&&clearTimeout(this._timer),this._timeouts=[],this._cachedTimeouts=null},t.prototype.retry=function(e){if(this._timeout&&clearTimeout(this._timeout),!e)return!1;var n=new Date().getTime();if(e&&n-this._operationStart>=this._maxRetryTime)return this._errors.push(e),this._errors.unshift(new Error("RetryOperation timeout occurred")),!1;this._errors.push(e);var r=this._timeouts.shift();if(r===void 0)if(this._cachedTimeouts)this._errors.splice(0,this._errors.length-1),r=this._cachedTimeouts.slice(-1);else return!1;var s=this;return this._timer=setTimeout(function(){s._attempts++,s._operationTimeoutCb&&(s._timeout=setTimeout(function(){s._operationTimeoutCb(s._attempts)},s._operationTimeout),s._options.unref&&s._timeout.unref()),s._fn(s._attempts)},r),this._options.unref&&this._timer.unref(),!0},t.prototype.attempt=function(e,n){this._fn=e,n&&(n.timeout&&(this._operationTimeout=n.timeout),n.cb&&(this._operationTimeoutCb=n.cb));var r=this;this._operationTimeoutCb&&(this._timeout=setTimeout(function(){r._operationTimeoutCb()},r._operationTimeout)),this._operationStart=new Date().getTime(),this._fn(this._attempts)},t.prototype.try=function(e){console.log("Using RetryOperation.try() is deprecated"),this.attempt(e)},t.prototype.start=function(e){console.log("Using RetryOperation.start() is deprecated"),this.attempt(e)},t.prototype.start=t.prototype.try,t.prototype.errors=function(){return this._errors},t.prototype.attempts=function(){return this._attempts},t.prototype.mainError=function(){if(this._errors.length===0)return null;for(var e={},n=null,r=0,s=0;s<this._errors.length;s++){var i=this._errors[s],o=i.message,c=(e[o]||0)+1;e[o]=c,c>=r&&(n=i,r=c)}return n},dc}var jf;function VP(){return jf||(jf=1,(function(t){var e=xP();t.operation=function(n){var r=t.timeouts(n);return new e(r,{forever:n&&(n.forever||n.retries===1/0),unref:n&&n.unref,maxRetryTime:n&&n.maxRetryTime})},t.timeouts=function(n){if(n instanceof Array)return[].concat(n);var r={retries:10,factor:2,minTimeout:1*1e3,maxTimeout:1/0,randomize:!1};for(var s in n)r[s]=n[s];if(r.minTimeout>r.maxTimeout)throw new Error("minTimeout is greater than maxTimeout");for(var i=[],o=0;o<r.retries;o++)i.push(this.createTimeout(o,r));return n&&n.forever&&!i.length&&i.push(this.createTimeout(o,r)),i.sort(function(c,l){return c-l}),i},t.createTimeout=function(n,r){var s=r.randomize?Math.random()+1:1,i=Math.round(s*Math.max(r.minTimeout,1)*Math.pow(r.factor,n));return i=Math.min(i,r.maxTimeout),i},t.wrap=function(n,r,s){if(r instanceof Array&&(s=r,r=null),!s){s=[];for(var i in n)typeof n[i]=="function"&&s.push(i)}for(var o=0;o<s.length;o++){var c=s[o],l=n[c];n[c]=(function(h){var f=t.operation(r),m=Array.prototype.slice.call(arguments,1),y=m.pop();m.push(function(w){f.retry(w)||(w&&(arguments[0]=f.mainError()),y.apply(this,arguments))}),f.attempt(function(){h.apply(n,m)})}).bind(n,l),n[c].options=r}}})(hc)),hc}var fc,$f;function DP(){return $f||($f=1,fc=VP()),fc}var zf;function MP(){if(zf)return ws.exports;zf=1;const t=DP(),e=["Failed to fetch","NetworkError when attempting to fetch resource.","The Internet connection appears to be offline.","Network request failed"];class n extends Error{constructor(c){super(),c instanceof Error?(this.originalError=c,{message:c}=c):(this.originalError=new Error(c),this.originalError.stack=this.stack),this.name="AbortError",this.message=c}}const r=(o,c,l)=>{const u=l.retries-(c-1);return o.attemptNumber=c,o.retriesLeft=u,o},s=o=>e.includes(o),i=(o,c)=>new Promise((l,u)=>{c={onFailedAttempt:()=>{},retries:10,...c};const h=t.operation(c);h.attempt(async f=>{try{l(await o(f))}catch(m){if(!(m instanceof Error)){u(new TypeError(`Non-error was thrown: "${m}". You should only throw errors.`));return}if(m instanceof n)h.stop(),u(m.originalError);else if(m instanceof TypeError&&!s(m.message))h.stop(),u(m);else{r(m,f,c);try{await c.onFailedAttempt(m)}catch(y){u(y);return}h.retry(m)||u(h.mainError())}}})});return ws.exports=i,ws.exports.default=i,ws.exports.AbortError=n,ws.exports}MP();const NP=()=>{};var qf={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qy=function(t){const e=[];let n=0;for(let r=0;r<t.length;r++){let s=t.charCodeAt(r);s<128?e[n++]=s:s<2048?(e[n++]=s>>6|192,e[n++]=s&63|128):(s&64512)===55296&&r+1<t.length&&(t.charCodeAt(r+1)&64512)===56320?(s=65536+((s&1023)<<10)+(t.charCodeAt(++r)&1023),e[n++]=s>>18|240,e[n++]=s>>12&63|128,e[n++]=s>>6&63|128,e[n++]=s&63|128):(e[n++]=s>>12|224,e[n++]=s>>6&63|128,e[n++]=s&63|128)}return e},LP=function(t){const e=[];let n=0,r=0;for(;n<t.length;){const s=t[n++];if(s<128)e[r++]=String.fromCharCode(s);else if(s>191&&s<224){const i=t[n++];e[r++]=String.fromCharCode((s&31)<<6|i&63)}else if(s>239&&s<365){const i=t[n++],o=t[n++],c=t[n++],l=((s&7)<<18|(i&63)<<12|(o&63)<<6|c&63)-65536;e[r++]=String.fromCharCode(55296+(l>>10)),e[r++]=String.fromCharCode(56320+(l&1023))}else{const i=t[n++],o=t[n++];e[r++]=String.fromCharCode((s&15)<<12|(i&63)<<6|o&63)}}return e.join("")},Wy={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();const n=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let s=0;s<t.length;s+=3){const i=t[s],o=s+1<t.length,c=o?t[s+1]:0,l=s+2<t.length,u=l?t[s+2]:0,h=i>>2,f=(i&3)<<4|c>>4;let m=(c&15)<<2|u>>6,y=u&63;l||(y=64,o||(m=64)),r.push(n[h],n[f],n[m],n[y])}return r.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(qy(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):LP(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();const n=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let s=0;s<t.length;){const i=n[t.charAt(s++)],c=s<t.length?n[t.charAt(s)]:0;++s;const u=s<t.length?n[t.charAt(s)]:64;++s;const f=s<t.length?n[t.charAt(s)]:64;if(++s,i==null||c==null||u==null||f==null)throw new OP;const m=i<<2|c>>4;if(r.push(m),u!==64){const y=c<<4&240|u>>2;if(r.push(y),f!==64){const w=u<<6&192|f;r.push(w)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}};class OP extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const FP=function(t){const e=qy(t);return Wy.encodeByteArray(e,!0)},Po=function(t){return FP(t).replace(/\./g,"")},Hy=function(t){try{return Wy.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function UP(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const BP=()=>UP().__FIREBASE_DEFAULTS__,jP=()=>{if(typeof process>"u"||typeof qf>"u")return;const t=qf.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},$P=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=t&&Hy(t[1]);return e&&JSON.parse(e)},ra=()=>{try{return NP()||BP()||jP()||$P()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},Gy=t=>{var e,n;return(n=(e=ra())==null?void 0:e.emulatorHosts)==null?void 0:n[t]},Ky=t=>{const e=Gy(t);if(!e)return;const n=e.lastIndexOf(":");if(n<=0||n+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(n+1),10);return e[0]==="["?[e.substring(1,n-1),r]:[e.substring(0,n),r]},Yy=()=>{var t;return(t=ra())==null?void 0:t.config},Qy=t=>{var e;return(e=ra())==null?void 0:e[`_${t}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zP{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}wrapCallback(e){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(n):e(n,r))}}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qP(t,e){if(t.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const n={alg:"none",type:"JWT"},r=e||"demo-project",s=t.iat||0,i=t.sub||t.user_id;if(!i)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o={iss:`https://securetoken.google.com/${r}`,aud:r,iat:s,exp:s+3600,auth_time:s,sub:i,user_id:i,firebase:{sign_in_provider:"custom",identities:{}},...t};return[Po(JSON.stringify(n)),Po(JSON.stringify(o)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function He(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function WP(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(He())}function HP(){var e;const t=(e=ra())==null?void 0:e.forceEnvironment;if(t==="node")return!0;if(t==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function GP(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function KP(){const t=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof t=="object"&&t.id!==void 0}function YP(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function QP(){const t=He();return t.indexOf("MSIE ")>=0||t.indexOf("Trident/")>=0}function XP(){return!HP()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function JP(){try{return typeof indexedDB=="object"}catch{return!1}}function ZP(){return new Promise((t,e)=>{try{let n=!0;const r="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(r);s.onsuccess=()=>{s.result.close(),n||self.indexedDB.deleteDatabase(r),t(!0)},s.onupgradeneeded=()=>{n=!1},s.onerror=()=>{var i;e(((i=s.error)==null?void 0:i.message)||"")}}catch(n){e(n)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const eC="FirebaseError";class Ot extends Error{constructor(e,n,r){super(n),this.code=e,this.customData=r,this.name=eC,Object.setPrototypeOf(this,Ot.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,ci.prototype.create)}}class ci{constructor(e,n,r){this.service=e,this.serviceName=n,this.errors=r}create(e,...n){const r=n[0]||{},s=`${this.service}/${e}`,i=this.errors[e],o=i?tC(i,r):"Error",c=`${this.serviceName}: ${o} (${s}).`;return new Ot(s,c,r)}}function tC(t,e){return t.replace(nC,(n,r)=>{const s=e[r];return s!=null?String(s):`<${r}?>`})}const nC=/\{\$([^}]+)}/g;function rC(t){for(const e in t)if(Object.prototype.hasOwnProperty.call(t,e))return!1;return!0}function nr(t,e){if(t===e)return!0;const n=Object.keys(t),r=Object.keys(e);for(const s of n){if(!r.includes(s))return!1;const i=t[s],o=e[s];if(Wf(i)&&Wf(o)){if(!nr(i,o))return!1}else if(i!==o)return!1}for(const s of r)if(!n.includes(s))return!1;return!0}function Wf(t){return t!==null&&typeof t=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function li(t){const e=[];for(const[n,r]of Object.entries(t))Array.isArray(r)?r.forEach(s=>{e.push(encodeURIComponent(n)+"="+encodeURIComponent(s))}):e.push(encodeURIComponent(n)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function sC(t,e){const n=new iC(t,e);return n.subscribe.bind(n)}class iC{constructor(e,n){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=n,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(n=>{n.next(e)})}error(e){this.forEachObserver(n=>{n.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,n,r){let s;if(e===void 0&&n===void 0&&r===void 0)throw new Error("Missing Observer.");oC(e,["next","error","complete"])?s=e:s={next:e,error:n,complete:r},s.next===void 0&&(s.next=pc),s.error===void 0&&(s.error=pc),s.complete===void 0&&(s.complete=pc);const i=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?s.error(this.finalError):s.complete()}catch{}}),this.observers.push(s),i}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let n=0;n<this.observers.length;n++)this.sendOne(n,e)}sendOne(e,n){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{n(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function oC(t,e){if(typeof t!="object"||t===null)return!1;for(const n of e)if(n in t&&typeof t[n]=="function")return!0;return!1}function pc(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ge(t){return t&&t._delegate?t._delegate:t}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ur(t){try{return(t.startsWith("http://")||t.startsWith("https://")?new URL(t).hostname:t).endsWith(".cloudworkstations.dev")}catch{return!1}}async function hu(t){return(await fetch(t,{credentials:"include"})).ok}class Tn{constructor(e,n,r){this.name=e,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class aC{constructor(e,n){this.name=e,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const n=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(n)){const r=new zP;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:n});s&&r.resolve(s)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(e){const n=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(s){if(r)return null;throw s}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(lC(e))try{this.getOrInitializeService({instanceIdentifier:Hn})}catch{}for(const[n,r]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(n);try{const i=this.getOrInitializeService({instanceIdentifier:s});r.resolve(i)}catch{}}}}clearInstance(e=Hn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...e.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=Hn){return this.instances.has(e)}getOptions(e=Hn){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:n={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:r,options:n});for(const[i,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(i);r===c&&o.resolve(s)}return s}onInit(e,n){const r=this.normalizeInstanceIdentifier(n),s=this.onInitCallbacks.get(r)??new Set;s.add(e),this.onInitCallbacks.set(r,s);const i=this.instances.get(r);return i&&e(i,r),()=>{s.delete(e)}}invokeOnInitCallbacks(e,n){const r=this.onInitCallbacks.get(n);if(r)for(const s of r)try{s(e,n)}catch{}}getOrInitializeService({instanceIdentifier:e,options:n={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:cC(e),options:n}),this.instances.set(e,r),this.instancesOptions.set(e,n),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=Hn){return this.component?this.component.multipleInstances?e:Hn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function cC(t){return t===Hn?void 0:t}function lC(t){return t.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uC{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const n=this.getProvider(e.name);if(n.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);n.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const n=new aC(e,this);return this.providers.set(e,n),n}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ee;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(ee||(ee={}));const hC={debug:ee.DEBUG,verbose:ee.VERBOSE,info:ee.INFO,warn:ee.WARN,error:ee.ERROR,silent:ee.SILENT},dC=ee.INFO,fC={[ee.DEBUG]:"log",[ee.VERBOSE]:"log",[ee.INFO]:"info",[ee.WARN]:"warn",[ee.ERROR]:"error"},pC=(t,e,...n)=>{if(e<t.logLevel)return;const r=new Date().toISOString(),s=fC[e];if(s)console[s](`[${r}]  ${t.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class du{constructor(e){this.name=e,this._logLevel=dC,this._logHandler=pC,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in ee))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?hC[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,ee.DEBUG,...e),this._logHandler(this,ee.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,ee.VERBOSE,...e),this._logHandler(this,ee.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,ee.INFO,...e),this._logHandler(this,ee.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,ee.WARN,...e),this._logHandler(this,ee.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,ee.ERROR,...e),this._logHandler(this,ee.ERROR,...e)}}const mC=(t,e)=>e.some(n=>t instanceof n);let Hf,Gf;function gC(){return Hf||(Hf=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function yC(){return Gf||(Gf=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Xy=new WeakMap,tl=new WeakMap,Jy=new WeakMap,mc=new WeakMap,fu=new WeakMap;function _C(t){const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("success",i),t.removeEventListener("error",o)},i=()=>{n(mn(t.result)),s()},o=()=>{r(t.error),s()};t.addEventListener("success",i),t.addEventListener("error",o)});return e.then(n=>{n instanceof IDBCursor&&Xy.set(n,t)}).catch(()=>{}),fu.set(e,t),e}function vC(t){if(tl.has(t))return;const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("complete",i),t.removeEventListener("error",o),t.removeEventListener("abort",o)},i=()=>{n(),s()},o=()=>{r(t.error||new DOMException("AbortError","AbortError")),s()};t.addEventListener("complete",i),t.addEventListener("error",o),t.addEventListener("abort",o)});tl.set(t,e)}let nl={get(t,e,n){if(t instanceof IDBTransaction){if(e==="done")return tl.get(t);if(e==="objectStoreNames")return t.objectStoreNames||Jy.get(t);if(e==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return mn(t[e])},set(t,e,n){return t[e]=n,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function wC(t){nl=t(nl)}function TC(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...n){const r=t.call(gc(this),e,...n);return Jy.set(r,e.sort?e.sort():[e]),mn(r)}:yC().includes(t)?function(...e){return t.apply(gc(this),e),mn(Xy.get(this))}:function(...e){return mn(t.apply(gc(this),e))}}function EC(t){return typeof t=="function"?TC(t):(t instanceof IDBTransaction&&vC(t),mC(t,gC())?new Proxy(t,nl):t)}function mn(t){if(t instanceof IDBRequest)return _C(t);if(mc.has(t))return mc.get(t);const e=EC(t);return e!==t&&(mc.set(t,e),fu.set(e,t)),e}const gc=t=>fu.get(t);function IC(t,e,{blocked:n,upgrade:r,blocking:s,terminated:i}={}){const o=indexedDB.open(t,e),c=mn(o);return r&&o.addEventListener("upgradeneeded",l=>{r(mn(o.result),l.oldVersion,l.newVersion,mn(o.transaction),l)}),n&&o.addEventListener("blocked",l=>n(l.oldVersion,l.newVersion,l)),c.then(l=>{i&&l.addEventListener("close",()=>i()),s&&l.addEventListener("versionchange",u=>s(u.oldVersion,u.newVersion,u))}).catch(()=>{}),c}const bC=["get","getKey","getAll","getAllKeys","count"],AC=["put","add","delete","clear"],yc=new Map;function Kf(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(yc.get(e))return yc.get(e);const n=e.replace(/FromIndex$/,""),r=e!==n,s=AC.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(s||bC.includes(n)))return;const i=async function(o,...c){const l=this.transaction(o,s?"readwrite":"readonly");let u=l.store;return r&&(u=u.index(c.shift())),(await Promise.all([u[n](...c),s&&l.done]))[0]};return yc.set(e,i),i}wC(t=>({...t,get:(e,n,r)=>Kf(e,n)||t.get(e,n,r),has:(e,n)=>!!Kf(e,n)||t.has(e,n)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RC{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(SC(n)){const r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}}function SC(t){const e=t.getComponent();return(e==null?void 0:e.type)==="VERSION"}const rl="@firebase/app",Yf="0.14.10";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Wt=new du("@firebase/app"),PC="@firebase/app-compat",CC="@firebase/analytics-compat",kC="@firebase/analytics",xC="@firebase/app-check-compat",VC="@firebase/app-check",DC="@firebase/auth",MC="@firebase/auth-compat",NC="@firebase/database",LC="@firebase/data-connect",OC="@firebase/database-compat",FC="@firebase/functions",UC="@firebase/functions-compat",BC="@firebase/installations",jC="@firebase/installations-compat",$C="@firebase/messaging",zC="@firebase/messaging-compat",qC="@firebase/performance",WC="@firebase/performance-compat",HC="@firebase/remote-config",GC="@firebase/remote-config-compat",KC="@firebase/storage",YC="@firebase/storage-compat",QC="@firebase/firestore",XC="@firebase/ai",JC="@firebase/firestore-compat",ZC="firebase",e1="12.11.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const sl="[DEFAULT]",t1={[rl]:"fire-core",[PC]:"fire-core-compat",[kC]:"fire-analytics",[CC]:"fire-analytics-compat",[VC]:"fire-app-check",[xC]:"fire-app-check-compat",[DC]:"fire-auth",[MC]:"fire-auth-compat",[NC]:"fire-rtdb",[LC]:"fire-data-connect",[OC]:"fire-rtdb-compat",[FC]:"fire-fn",[UC]:"fire-fn-compat",[BC]:"fire-iid",[jC]:"fire-iid-compat",[$C]:"fire-fcm",[zC]:"fire-fcm-compat",[qC]:"fire-perf",[WC]:"fire-perf-compat",[HC]:"fire-rc",[GC]:"fire-rc-compat",[KC]:"fire-gcs",[YC]:"fire-gcs-compat",[QC]:"fire-fst",[JC]:"fire-fst-compat",[XC]:"fire-vertex","fire-js":"fire-js",[ZC]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Co=new Map,n1=new Map,il=new Map;function Qf(t,e){try{t.container.addComponent(e)}catch(n){Wt.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,n)}}function rr(t){const e=t.name;if(il.has(e))return Wt.debug(`There were multiple attempts to register component ${e}.`),!1;il.set(e,t);for(const n of Co.values())Qf(n,t);for(const n of n1.values())Qf(n,t);return!0}function sa(t,e){const n=t.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),t.container.getProvider(e)}function nt(t){return t==null?!1:t.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const r1={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},gn=new ci("app","Firebase",r1);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class s1{constructor(e,n,r){this._isDeleted=!1,this._options={...e},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new Tn("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw gn.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Wr=e1;function i1(t,e={}){let n=t;typeof e!="object"&&(e={name:e});const r={name:sl,automaticDataCollectionEnabled:!0,...e},s=r.name;if(typeof s!="string"||!s)throw gn.create("bad-app-name",{appName:String(s)});if(n||(n=Yy()),!n)throw gn.create("no-options");const i=Co.get(s);if(i){if(nr(n,i.options)&&nr(r,i.config))return i;throw gn.create("duplicate-app",{appName:s})}const o=new uC(s);for(const l of il.values())o.addComponent(l);const c=new s1(n,r,o);return Co.set(s,c),c}function pu(t=sl){const e=Co.get(t);if(!e&&t===sl&&Yy())return i1();if(!e)throw gn.create("no-app",{appName:t});return e}function jt(t,e,n){let r=t1[t]??t;n&&(r+=`-${n}`);const s=r.match(/\s|\//),i=e.match(/\s|\//);if(s||i){const o=[`Unable to register library "${r}" with version "${e}":`];s&&o.push(`library name "${r}" contains illegal characters (whitespace or "/")`),s&&i&&o.push("and"),i&&o.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Wt.warn(o.join(" "));return}rr(new Tn(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const o1="firebase-heartbeat-database",a1=1,Ws="firebase-heartbeat-store";let _c=null;function Zy(){return _c||(_c=IC(o1,a1,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(Ws)}catch(n){console.warn(n)}}}}).catch(t=>{throw gn.create("idb-open",{originalErrorMessage:t.message})})),_c}async function c1(t){try{const n=(await Zy()).transaction(Ws),r=await n.objectStore(Ws).get(e_(t));return await n.done,r}catch(e){if(e instanceof Ot)Wt.warn(e.message);else{const n=gn.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});Wt.warn(n.message)}}}async function Xf(t,e){try{const r=(await Zy()).transaction(Ws,"readwrite");await r.objectStore(Ws).put(e,e_(t)),await r.done}catch(n){if(n instanceof Ot)Wt.warn(n.message);else{const r=gn.create("idb-set",{originalErrorMessage:n==null?void 0:n.message});Wt.warn(r.message)}}}function e_(t){return`${t.name}!${t.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const l1=1024,u1=30;class h1{constructor(e){this.container=e,this._heartbeatsCache=null;const n=this.container.getProvider("app").getImmediate();this._storage=new f1(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,n;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=Jf();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(o=>o.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:s}),this._heartbeatsCache.heartbeats.length>u1){const o=p1(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){Wt.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const n=Jf(),{heartbeatsToSend:r,unsentEntries:s}=d1(this._heartbeatsCache.heartbeats),i=Po(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(n){return Wt.warn(n),""}}}function Jf(){return new Date().toISOString().substring(0,10)}function d1(t,e=l1){const n=[];let r=t.slice();for(const s of t){const i=n.find(o=>o.agent===s.agent);if(i){if(i.dates.push(s.date),Zf(n)>e){i.dates.pop();break}}else if(n.push({agent:s.agent,dates:[s.date]}),Zf(n)>e){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}class f1{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return JP()?ZP().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const n=await c1(this.app);return n!=null&&n.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Xf(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return Xf(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function Zf(t){return Po(JSON.stringify({version:2,heartbeats:t})).length}function p1(t){if(t.length===0)return-1;let e=0,n=t[0].date;for(let r=1;r<t.length;r++)t[r].date<n&&(n=t[r].date,e=r);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function m1(t){rr(new Tn("platform-logger",e=>new RC(e),"PRIVATE")),rr(new Tn("heartbeat",e=>new h1(e),"PRIVATE")),jt(rl,Yf,t),jt(rl,Yf,"esm2020"),jt("fire-js","")}m1("");var ep=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var yn,t_;(function(){var t;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(b,g){function v(){}v.prototype=g.prototype,b.F=g.prototype,b.prototype=new v,b.prototype.constructor=b,b.D=function(E,A,C){for(var T=Array(arguments.length-2),ie=2;ie<arguments.length;ie++)T[ie-2]=arguments[ie];return g.prototype[A].apply(E,T)}}function n(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(r,n),r.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function s(b,g,v){v||(v=0);const E=Array(16);if(typeof g=="string")for(var A=0;A<16;++A)E[A]=g.charCodeAt(v++)|g.charCodeAt(v++)<<8|g.charCodeAt(v++)<<16|g.charCodeAt(v++)<<24;else for(A=0;A<16;++A)E[A]=g[v++]|g[v++]<<8|g[v++]<<16|g[v++]<<24;g=b.g[0],v=b.g[1],A=b.g[2];let C=b.g[3],T;T=g+(C^v&(A^C))+E[0]+3614090360&4294967295,g=v+(T<<7&4294967295|T>>>25),T=C+(A^g&(v^A))+E[1]+3905402710&4294967295,C=g+(T<<12&4294967295|T>>>20),T=A+(v^C&(g^v))+E[2]+606105819&4294967295,A=C+(T<<17&4294967295|T>>>15),T=v+(g^A&(C^g))+E[3]+3250441966&4294967295,v=A+(T<<22&4294967295|T>>>10),T=g+(C^v&(A^C))+E[4]+4118548399&4294967295,g=v+(T<<7&4294967295|T>>>25),T=C+(A^g&(v^A))+E[5]+1200080426&4294967295,C=g+(T<<12&4294967295|T>>>20),T=A+(v^C&(g^v))+E[6]+2821735955&4294967295,A=C+(T<<17&4294967295|T>>>15),T=v+(g^A&(C^g))+E[7]+4249261313&4294967295,v=A+(T<<22&4294967295|T>>>10),T=g+(C^v&(A^C))+E[8]+1770035416&4294967295,g=v+(T<<7&4294967295|T>>>25),T=C+(A^g&(v^A))+E[9]+2336552879&4294967295,C=g+(T<<12&4294967295|T>>>20),T=A+(v^C&(g^v))+E[10]+4294925233&4294967295,A=C+(T<<17&4294967295|T>>>15),T=v+(g^A&(C^g))+E[11]+2304563134&4294967295,v=A+(T<<22&4294967295|T>>>10),T=g+(C^v&(A^C))+E[12]+1804603682&4294967295,g=v+(T<<7&4294967295|T>>>25),T=C+(A^g&(v^A))+E[13]+4254626195&4294967295,C=g+(T<<12&4294967295|T>>>20),T=A+(v^C&(g^v))+E[14]+2792965006&4294967295,A=C+(T<<17&4294967295|T>>>15),T=v+(g^A&(C^g))+E[15]+1236535329&4294967295,v=A+(T<<22&4294967295|T>>>10),T=g+(A^C&(v^A))+E[1]+4129170786&4294967295,g=v+(T<<5&4294967295|T>>>27),T=C+(v^A&(g^v))+E[6]+3225465664&4294967295,C=g+(T<<9&4294967295|T>>>23),T=A+(g^v&(C^g))+E[11]+643717713&4294967295,A=C+(T<<14&4294967295|T>>>18),T=v+(C^g&(A^C))+E[0]+3921069994&4294967295,v=A+(T<<20&4294967295|T>>>12),T=g+(A^C&(v^A))+E[5]+3593408605&4294967295,g=v+(T<<5&4294967295|T>>>27),T=C+(v^A&(g^v))+E[10]+38016083&4294967295,C=g+(T<<9&4294967295|T>>>23),T=A+(g^v&(C^g))+E[15]+3634488961&4294967295,A=C+(T<<14&4294967295|T>>>18),T=v+(C^g&(A^C))+E[4]+3889429448&4294967295,v=A+(T<<20&4294967295|T>>>12),T=g+(A^C&(v^A))+E[9]+568446438&4294967295,g=v+(T<<5&4294967295|T>>>27),T=C+(v^A&(g^v))+E[14]+3275163606&4294967295,C=g+(T<<9&4294967295|T>>>23),T=A+(g^v&(C^g))+E[3]+4107603335&4294967295,A=C+(T<<14&4294967295|T>>>18),T=v+(C^g&(A^C))+E[8]+1163531501&4294967295,v=A+(T<<20&4294967295|T>>>12),T=g+(A^C&(v^A))+E[13]+2850285829&4294967295,g=v+(T<<5&4294967295|T>>>27),T=C+(v^A&(g^v))+E[2]+4243563512&4294967295,C=g+(T<<9&4294967295|T>>>23),T=A+(g^v&(C^g))+E[7]+1735328473&4294967295,A=C+(T<<14&4294967295|T>>>18),T=v+(C^g&(A^C))+E[12]+2368359562&4294967295,v=A+(T<<20&4294967295|T>>>12),T=g+(v^A^C)+E[5]+4294588738&4294967295,g=v+(T<<4&4294967295|T>>>28),T=C+(g^v^A)+E[8]+2272392833&4294967295,C=g+(T<<11&4294967295|T>>>21),T=A+(C^g^v)+E[11]+1839030562&4294967295,A=C+(T<<16&4294967295|T>>>16),T=v+(A^C^g)+E[14]+4259657740&4294967295,v=A+(T<<23&4294967295|T>>>9),T=g+(v^A^C)+E[1]+2763975236&4294967295,g=v+(T<<4&4294967295|T>>>28),T=C+(g^v^A)+E[4]+1272893353&4294967295,C=g+(T<<11&4294967295|T>>>21),T=A+(C^g^v)+E[7]+4139469664&4294967295,A=C+(T<<16&4294967295|T>>>16),T=v+(A^C^g)+E[10]+3200236656&4294967295,v=A+(T<<23&4294967295|T>>>9),T=g+(v^A^C)+E[13]+681279174&4294967295,g=v+(T<<4&4294967295|T>>>28),T=C+(g^v^A)+E[0]+3936430074&4294967295,C=g+(T<<11&4294967295|T>>>21),T=A+(C^g^v)+E[3]+3572445317&4294967295,A=C+(T<<16&4294967295|T>>>16),T=v+(A^C^g)+E[6]+76029189&4294967295,v=A+(T<<23&4294967295|T>>>9),T=g+(v^A^C)+E[9]+3654602809&4294967295,g=v+(T<<4&4294967295|T>>>28),T=C+(g^v^A)+E[12]+3873151461&4294967295,C=g+(T<<11&4294967295|T>>>21),T=A+(C^g^v)+E[15]+530742520&4294967295,A=C+(T<<16&4294967295|T>>>16),T=v+(A^C^g)+E[2]+3299628645&4294967295,v=A+(T<<23&4294967295|T>>>9),T=g+(A^(v|~C))+E[0]+4096336452&4294967295,g=v+(T<<6&4294967295|T>>>26),T=C+(v^(g|~A))+E[7]+1126891415&4294967295,C=g+(T<<10&4294967295|T>>>22),T=A+(g^(C|~v))+E[14]+2878612391&4294967295,A=C+(T<<15&4294967295|T>>>17),T=v+(C^(A|~g))+E[5]+4237533241&4294967295,v=A+(T<<21&4294967295|T>>>11),T=g+(A^(v|~C))+E[12]+1700485571&4294967295,g=v+(T<<6&4294967295|T>>>26),T=C+(v^(g|~A))+E[3]+2399980690&4294967295,C=g+(T<<10&4294967295|T>>>22),T=A+(g^(C|~v))+E[10]+4293915773&4294967295,A=C+(T<<15&4294967295|T>>>17),T=v+(C^(A|~g))+E[1]+2240044497&4294967295,v=A+(T<<21&4294967295|T>>>11),T=g+(A^(v|~C))+E[8]+1873313359&4294967295,g=v+(T<<6&4294967295|T>>>26),T=C+(v^(g|~A))+E[15]+4264355552&4294967295,C=g+(T<<10&4294967295|T>>>22),T=A+(g^(C|~v))+E[6]+2734768916&4294967295,A=C+(T<<15&4294967295|T>>>17),T=v+(C^(A|~g))+E[13]+1309151649&4294967295,v=A+(T<<21&4294967295|T>>>11),T=g+(A^(v|~C))+E[4]+4149444226&4294967295,g=v+(T<<6&4294967295|T>>>26),T=C+(v^(g|~A))+E[11]+3174756917&4294967295,C=g+(T<<10&4294967295|T>>>22),T=A+(g^(C|~v))+E[2]+718787259&4294967295,A=C+(T<<15&4294967295|T>>>17),T=v+(C^(A|~g))+E[9]+3951481745&4294967295,b.g[0]=b.g[0]+g&4294967295,b.g[1]=b.g[1]+(A+(T<<21&4294967295|T>>>11))&4294967295,b.g[2]=b.g[2]+A&4294967295,b.g[3]=b.g[3]+C&4294967295}r.prototype.v=function(b,g){g===void 0&&(g=b.length);const v=g-this.blockSize,E=this.C;let A=this.h,C=0;for(;C<g;){if(A==0)for(;C<=v;)s(this,b,C),C+=this.blockSize;if(typeof b=="string"){for(;C<g;)if(E[A++]=b.charCodeAt(C++),A==this.blockSize){s(this,E),A=0;break}}else for(;C<g;)if(E[A++]=b[C++],A==this.blockSize){s(this,E),A=0;break}}this.h=A,this.o+=g},r.prototype.A=function(){var b=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);b[0]=128;for(var g=1;g<b.length-8;++g)b[g]=0;g=this.o*8;for(var v=b.length-8;v<b.length;++v)b[v]=g&255,g/=256;for(this.v(b),b=Array(16),g=0,v=0;v<4;++v)for(let E=0;E<32;E+=8)b[g++]=this.g[v]>>>E&255;return b};function i(b,g){var v=c;return Object.prototype.hasOwnProperty.call(v,b)?v[b]:v[b]=g(b)}function o(b,g){this.h=g;const v=[];let E=!0;for(let A=b.length-1;A>=0;A--){const C=b[A]|0;E&&C==g||(v[A]=C,E=!1)}this.g=v}var c={};function l(b){return-128<=b&&b<128?i(b,function(g){return new o([g|0],g<0?-1:0)}):new o([b|0],b<0?-1:0)}function u(b){if(isNaN(b)||!isFinite(b))return f;if(b<0)return I(u(-b));const g=[];let v=1;for(let E=0;b>=v;E++)g[E]=b/v|0,v*=4294967296;return new o(g,0)}function h(b,g){if(b.length==0)throw Error("number format error: empty string");if(g=g||10,g<2||36<g)throw Error("radix out of range: "+g);if(b.charAt(0)=="-")return I(h(b.substring(1),g));if(b.indexOf("-")>=0)throw Error('number format error: interior "-" character');const v=u(Math.pow(g,8));let E=f;for(let C=0;C<b.length;C+=8){var A=Math.min(8,b.length-C);const T=parseInt(b.substring(C,C+A),g);A<8?(A=u(Math.pow(g,A)),E=E.j(A).add(u(T))):(E=E.j(v),E=E.add(u(T)))}return E}var f=l(0),m=l(1),y=l(16777216);t=o.prototype,t.m=function(){if(R(this))return-I(this).m();let b=0,g=1;for(let v=0;v<this.g.length;v++){const E=this.i(v);b+=(E>=0?E:4294967296+E)*g,g*=4294967296}return b},t.toString=function(b){if(b=b||10,b<2||36<b)throw Error("radix out of range: "+b);if(w(this))return"0";if(R(this))return"-"+I(this).toString(b);const g=u(Math.pow(b,6));var v=this;let E="";for(;;){const A=L(v,g).g;v=P(v,A.j(g));let C=((v.g.length>0?v.g[0]:v.h)>>>0).toString(b);if(v=A,w(v))return C+E;for(;C.length<6;)C="0"+C;E=C+E}},t.i=function(b){return b<0?0:b<this.g.length?this.g[b]:this.h};function w(b){if(b.h!=0)return!1;for(let g=0;g<b.g.length;g++)if(b.g[g]!=0)return!1;return!0}function R(b){return b.h==-1}t.l=function(b){return b=P(this,b),R(b)?-1:w(b)?0:1};function I(b){const g=b.g.length,v=[];for(let E=0;E<g;E++)v[E]=~b.g[E];return new o(v,~b.h).add(m)}t.abs=function(){return R(this)?I(this):this},t.add=function(b){const g=Math.max(this.g.length,b.g.length),v=[];let E=0;for(let A=0;A<=g;A++){let C=E+(this.i(A)&65535)+(b.i(A)&65535),T=(C>>>16)+(this.i(A)>>>16)+(b.i(A)>>>16);E=T>>>16,C&=65535,T&=65535,v[A]=T<<16|C}return new o(v,v[v.length-1]&-2147483648?-1:0)};function P(b,g){return b.add(I(g))}t.j=function(b){if(w(this)||w(b))return f;if(R(this))return R(b)?I(this).j(I(b)):I(I(this).j(b));if(R(b))return I(this.j(I(b)));if(this.l(y)<0&&b.l(y)<0)return u(this.m()*b.m());const g=this.g.length+b.g.length,v=[];for(var E=0;E<2*g;E++)v[E]=0;for(E=0;E<this.g.length;E++)for(let A=0;A<b.g.length;A++){const C=this.i(E)>>>16,T=this.i(E)&65535,ie=b.i(A)>>>16,se=b.i(A)&65535;v[2*E+2*A]+=T*se,x(v,2*E+2*A),v[2*E+2*A+1]+=C*se,x(v,2*E+2*A+1),v[2*E+2*A+1]+=T*ie,x(v,2*E+2*A+1),v[2*E+2*A+2]+=C*ie,x(v,2*E+2*A+2)}for(b=0;b<g;b++)v[b]=v[2*b+1]<<16|v[2*b];for(b=g;b<2*g;b++)v[b]=0;return new o(v,0)};function x(b,g){for(;(b[g]&65535)!=b[g];)b[g+1]+=b[g]>>>16,b[g]&=65535,g++}function V(b,g){this.g=b,this.h=g}function L(b,g){if(w(g))throw Error("division by zero");if(w(b))return new V(f,f);if(R(b))return g=L(I(b),g),new V(I(g.g),I(g.h));if(R(g))return g=L(b,I(g)),new V(I(g.g),g.h);if(b.g.length>30){if(R(b)||R(g))throw Error("slowDivide_ only works with positive integers.");for(var v=m,E=g;E.l(b)<=0;)v=O(v),E=O(E);var A=z(v,1),C=z(E,1);for(E=z(E,2),v=z(v,2);!w(E);){var T=C.add(E);T.l(b)<=0&&(A=A.add(v),C=T),E=z(E,1),v=z(v,1)}return g=P(b,A.j(g)),new V(A,g)}for(A=f;b.l(g)>=0;){for(v=Math.max(1,Math.floor(b.m()/g.m())),E=Math.ceil(Math.log(v)/Math.LN2),E=E<=48?1:Math.pow(2,E-48),C=u(v),T=C.j(g);R(T)||T.l(b)>0;)v-=E,C=u(v),T=C.j(g);w(C)&&(C=m),A=A.add(C),b=P(b,T)}return new V(A,b)}t.B=function(b){return L(this,b).h},t.and=function(b){const g=Math.max(this.g.length,b.g.length),v=[];for(let E=0;E<g;E++)v[E]=this.i(E)&b.i(E);return new o(v,this.h&b.h)},t.or=function(b){const g=Math.max(this.g.length,b.g.length),v=[];for(let E=0;E<g;E++)v[E]=this.i(E)|b.i(E);return new o(v,this.h|b.h)},t.xor=function(b){const g=Math.max(this.g.length,b.g.length),v=[];for(let E=0;E<g;E++)v[E]=this.i(E)^b.i(E);return new o(v,this.h^b.h)};function O(b){const g=b.g.length+1,v=[];for(let E=0;E<g;E++)v[E]=b.i(E)<<1|b.i(E-1)>>>31;return new o(v,b.h)}function z(b,g){const v=g>>5;g%=32;const E=b.g.length-v,A=[];for(let C=0;C<E;C++)A[C]=g>0?b.i(C+v)>>>g|b.i(C+v+1)<<32-g:b.i(C+v);return new o(A,b.h)}r.prototype.digest=r.prototype.A,r.prototype.reset=r.prototype.u,r.prototype.update=r.prototype.v,t_=r,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.B,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=u,o.fromString=h,yn=o}).apply(typeof ep<"u"?ep:typeof self<"u"?self:typeof window<"u"?window:{});var qi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var n_,bs,r_,oo,ol,s_,i_,o_;(function(){var t,e=Object.defineProperty;function n(a){a=[typeof globalThis=="object"&&globalThis,a,typeof window=="object"&&window,typeof self=="object"&&self,typeof qi=="object"&&qi];for(var d=0;d<a.length;++d){var p=a[d];if(p&&p.Math==Math)return p}throw Error("Cannot find global object")}var r=n(this);function s(a,d){if(d)e:{var p=r;a=a.split(".");for(var _=0;_<a.length-1;_++){var k=a[_];if(!(k in p))break e;p=p[k]}a=a[a.length-1],_=p[a],d=d(_),d!=_&&d!=null&&e(p,a,{configurable:!0,writable:!0,value:d})}}s("Symbol.dispose",function(a){return a||Symbol("Symbol.dispose")}),s("Array.prototype.values",function(a){return a||function(){return this[Symbol.iterator]()}}),s("Object.entries",function(a){return a||function(d){var p=[],_;for(_ in d)Object.prototype.hasOwnProperty.call(d,_)&&p.push([_,d[_]]);return p}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var i=i||{},o=this||self;function c(a){var d=typeof a;return d=="object"&&a!=null||d=="function"}function l(a,d,p){return a.call.apply(a.bind,arguments)}function u(a,d,p){return u=l,u.apply(null,arguments)}function h(a,d){var p=Array.prototype.slice.call(arguments,1);return function(){var _=p.slice();return _.push.apply(_,arguments),a.apply(this,_)}}function f(a,d){function p(){}p.prototype=d.prototype,a.Z=d.prototype,a.prototype=new p,a.prototype.constructor=a,a.Ob=function(_,k,D){for(var F=Array(arguments.length-2),J=2;J<arguments.length;J++)F[J-2]=arguments[J];return d.prototype[k].apply(_,F)}}var m=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?a=>a&&AsyncContext.Snapshot.wrap(a):a=>a;function y(a){const d=a.length;if(d>0){const p=Array(d);for(let _=0;_<d;_++)p[_]=a[_];return p}return[]}function w(a,d){for(let _=1;_<arguments.length;_++){const k=arguments[_];var p=typeof k;if(p=p!="object"?p:k?Array.isArray(k)?"array":p:"null",p=="array"||p=="object"&&typeof k.length=="number"){p=a.length||0;const D=k.length||0;a.length=p+D;for(let F=0;F<D;F++)a[p+F]=k[F]}else a.push(k)}}class R{constructor(d,p){this.i=d,this.j=p,this.h=0,this.g=null}get(){let d;return this.h>0?(this.h--,d=this.g,this.g=d.next,d.next=null):d=this.i(),d}}function I(a){o.setTimeout(()=>{throw a},0)}function P(){var a=b;let d=null;return a.g&&(d=a.g,a.g=a.g.next,a.g||(a.h=null),d.next=null),d}class x{constructor(){this.h=this.g=null}add(d,p){const _=V.get();_.set(d,p),this.h?this.h.next=_:this.g=_,this.h=_}}var V=new R(()=>new L,a=>a.reset());class L{constructor(){this.next=this.g=this.h=null}set(d,p){this.h=d,this.g=p,this.next=null}reset(){this.next=this.g=this.h=null}}let O,z=!1,b=new x,g=()=>{const a=Promise.resolve(void 0);O=()=>{a.then(v)}};function v(){for(var a;a=P();){try{a.h.call(a.g)}catch(p){I(p)}var d=V;d.j(a),d.h<100&&(d.h++,a.next=d.g,d.g=a)}z=!1}function E(){this.u=this.u,this.C=this.C}E.prototype.u=!1,E.prototype.dispose=function(){this.u||(this.u=!0,this.N())},E.prototype[Symbol.dispose]=function(){this.dispose()},E.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function A(a,d){this.type=a,this.g=this.target=d,this.defaultPrevented=!1}A.prototype.h=function(){this.defaultPrevented=!0};var C=(function(){if(!o.addEventListener||!Object.defineProperty)return!1;var a=!1,d=Object.defineProperty({},"passive",{get:function(){a=!0}});try{const p=()=>{};o.addEventListener("test",p,d),o.removeEventListener("test",p,d)}catch{}return a})();function T(a){return/^[\s\xa0]*$/.test(a)}function ie(a,d){A.call(this,a?a.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,a&&this.init(a,d)}f(ie,A),ie.prototype.init=function(a,d){const p=this.type=a.type,_=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;this.target=a.target||a.srcElement,this.g=d,d=a.relatedTarget,d||(p=="mouseover"?d=a.fromElement:p=="mouseout"&&(d=a.toElement)),this.relatedTarget=d,_?(this.clientX=_.clientX!==void 0?_.clientX:_.pageX,this.clientY=_.clientY!==void 0?_.clientY:_.pageY,this.screenX=_.screenX||0,this.screenY=_.screenY||0):(this.clientX=a.clientX!==void 0?a.clientX:a.pageX,this.clientY=a.clientY!==void 0?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0),this.button=a.button,this.key=a.key||"",this.ctrlKey=a.ctrlKey,this.altKey=a.altKey,this.shiftKey=a.shiftKey,this.metaKey=a.metaKey,this.pointerId=a.pointerId||0,this.pointerType=a.pointerType,this.state=a.state,this.i=a,a.defaultPrevented&&ie.Z.h.call(this)},ie.prototype.h=function(){ie.Z.h.call(this);const a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1};var se="closure_listenable_"+(Math.random()*1e6|0),pe=0;function wt(a,d,p,_,k){this.listener=a,this.proxy=null,this.src=d,this.type=p,this.capture=!!_,this.ha=k,this.key=++pe,this.da=this.fa=!1}function le(a){a.da=!0,a.listener=null,a.proxy=null,a.src=null,a.ha=null}function Te(a,d,p){for(const _ in a)d.call(p,a[_],_,a)}function H(a,d){for(const p in a)d.call(void 0,a[p],p,a)}function ot(a){const d={};for(const p in a)d[p]=a[p];return d}const Mn="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function es(a,d){let p,_;for(let k=1;k<arguments.length;k++){_=arguments[k];for(p in _)a[p]=_[p];for(let D=0;D<Mn.length;D++)p=Mn[D],Object.prototype.hasOwnProperty.call(_,p)&&(a[p]=_[p])}}function Yt(a){this.src=a,this.g={},this.h=0}Yt.prototype.add=function(a,d,p,_,k){const D=a.toString();a=this.g[D],a||(a=this.g[D]=[],this.h++);const F=Ce(a,d,_,k);return F>-1?(d=a[F],p||(d.fa=!1)):(d=new wt(d,this.src,D,!!_,k),d.fa=p,a.push(d)),d};function Pe(a,d){const p=d.type;if(p in a.g){var _=a.g[p],k=Array.prototype.indexOf.call(_,d,void 0),D;(D=k>=0)&&Array.prototype.splice.call(_,k,1),D&&(le(d),a.g[p].length==0&&(delete a.g[p],a.h--))}}function Ce(a,d,p,_){for(let k=0;k<a.length;++k){const D=a[k];if(!D.da&&D.listener==d&&D.capture==!!p&&D.ha==_)return k}return-1}var Qt="closure_lm_"+(Math.random()*1e6|0),fr={};function Ee(a,d,p,_,k){if(Array.isArray(d)){for(let D=0;D<d.length;D++)Ee(a,d[D],p,_,k);return null}return p=hh(p),a&&a[se]?a.J(d,p,c(_)?!!_.capture:!1,k):Ei(a,d,p,!1,_,k)}function Ei(a,d,p,_,k,D){if(!d)throw Error("Invalid event type");const F=c(k)?!!k.capture:!!k;let J=Ra(a);if(J||(a[Qt]=J=new Yt(a)),p=J.add(d,p,_,F,D),p.proxy)return p;if(_=pr(),p.proxy=_,_.src=a,_.listener=p,a.addEventListener)C||(k=F),k===void 0&&(k=!1),a.addEventListener(d.toString(),_,k);else if(a.attachEvent)a.attachEvent(On(d.toString()),_);else if(a.addListener&&a.removeListener)a.addListener(_);else throw Error("addEventListener and attachEvent are unavailable.");return p}function pr(){function a(p){return d.call(a.src,a.listener,p)}const d=yw;return a}function Nn(a,d,p,_,k){if(Array.isArray(d))for(var D=0;D<d.length;D++)Nn(a,d[D],p,_,k);else _=c(_)?!!_.capture:!!_,p=hh(p),a&&a[se]?(a=a.i,D=String(d).toString(),D in a.g&&(d=a.g[D],p=Ce(d,p,_,k),p>-1&&(le(d[p]),Array.prototype.splice.call(d,p,1),d.length==0&&(delete a.g[D],a.h--)))):a&&(a=Ra(a))&&(d=a.g[d.toString()],a=-1,d&&(a=Ce(d,p,_,k)),(p=a>-1?d[a]:null)&&Ln(p))}function Ln(a){if(typeof a!="number"&&a&&!a.da){var d=a.src;if(d&&d[se])Pe(d.i,a);else{var p=a.type,_=a.proxy;d.removeEventListener?d.removeEventListener(p,_,a.capture):d.detachEvent?d.detachEvent(On(p),_):d.addListener&&d.removeListener&&d.removeListener(_),(p=Ra(d))?(Pe(p,a),p.h==0&&(p.src=null,d[Qt]=null)):le(a)}}}function On(a){return a in fr?fr[a]:fr[a]="on"+a}function yw(a,d){if(a.da)a=!0;else{d=new ie(d,this);const p=a.listener,_=a.ha||a.src;a.fa&&Ln(a),a=p.call(_,d)}return a}function Ra(a){return a=a[Qt],a instanceof Yt?a:null}var Sa="__closure_events_fn_"+(Math.random()*1e9>>>0);function hh(a){return typeof a=="function"?a:(a[Sa]||(a[Sa]=function(d){return a.handleEvent(d)}),a[Sa])}function $e(){E.call(this),this.i=new Yt(this),this.M=this,this.G=null}f($e,E),$e.prototype[se]=!0,$e.prototype.removeEventListener=function(a,d,p,_){Nn(this,a,d,p,_)};function Ge(a,d){var p,_=a.G;if(_)for(p=[];_;_=_.G)p.push(_);if(a=a.M,_=d.type||d,typeof d=="string")d=new A(d,a);else if(d instanceof A)d.target=d.target||a;else{var k=d;d=new A(_,a),es(d,k)}k=!0;let D,F;if(p)for(F=p.length-1;F>=0;F--)D=d.g=p[F],k=Ii(D,_,!0,d)&&k;if(D=d.g=a,k=Ii(D,_,!0,d)&&k,k=Ii(D,_,!1,d)&&k,p)for(F=0;F<p.length;F++)D=d.g=p[F],k=Ii(D,_,!1,d)&&k}$e.prototype.N=function(){if($e.Z.N.call(this),this.i){var a=this.i;for(const d in a.g){const p=a.g[d];for(let _=0;_<p.length;_++)le(p[_]);delete a.g[d],a.h--}}this.G=null},$e.prototype.J=function(a,d,p,_){return this.i.add(String(a),d,!1,p,_)},$e.prototype.K=function(a,d,p,_){return this.i.add(String(a),d,!0,p,_)};function Ii(a,d,p,_){if(d=a.i.g[String(d)],!d)return!0;d=d.concat();let k=!0;for(let D=0;D<d.length;++D){const F=d[D];if(F&&!F.da&&F.capture==p){const J=F.listener,ke=F.ha||F.src;F.fa&&Pe(a.i,F),k=J.call(ke,_)!==!1&&k}}return k&&!_.defaultPrevented}function _w(a,d){if(typeof a!="function")if(a&&typeof a.handleEvent=="function")a=u(a.handleEvent,a);else throw Error("Invalid listener argument");return Number(d)>2147483647?-1:o.setTimeout(a,d||0)}function dh(a){a.g=_w(()=>{a.g=null,a.i&&(a.i=!1,dh(a))},a.l);const d=a.h;a.h=null,a.m.apply(null,d)}class vw extends E{constructor(d,p){super(),this.m=d,this.l=p,this.h=null,this.i=!1,this.g=null}j(d){this.h=arguments,this.g?this.i=!0:dh(this)}N(){super.N(),this.g&&(o.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function ts(a){E.call(this),this.h=a,this.g={}}f(ts,E);var fh=[];function ph(a){Te(a.g,function(d,p){this.g.hasOwnProperty(p)&&Ln(d)},a),a.g={}}ts.prototype.N=function(){ts.Z.N.call(this),ph(this)},ts.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Pa=o.JSON.stringify,ww=o.JSON.parse,Tw=class{stringify(a){return o.JSON.stringify(a,void 0)}parse(a){return o.JSON.parse(a,void 0)}};function mh(){}function gh(){}var ns={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function Ca(){A.call(this,"d")}f(Ca,A);function ka(){A.call(this,"c")}f(ka,A);var Fn={},yh=null;function bi(){return yh=yh||new $e}Fn.Ia="serverreachability";function _h(a){A.call(this,Fn.Ia,a)}f(_h,A);function rs(a){const d=bi();Ge(d,new _h(d))}Fn.STAT_EVENT="statevent";function vh(a,d){A.call(this,Fn.STAT_EVENT,a),this.stat=d}f(vh,A);function Ke(a){const d=bi();Ge(d,new vh(d,a))}Fn.Ja="timingevent";function wh(a,d){A.call(this,Fn.Ja,a),this.size=d}f(wh,A);function ss(a,d){if(typeof a!="function")throw Error("Fn must not be null and must be a function");return o.setTimeout(function(){a()},d)}function is(){this.g=!0}is.prototype.ua=function(){this.g=!1};function Ew(a,d,p,_,k,D){a.info(function(){if(a.g)if(D){var F="",J=D.split("&");for(let ce=0;ce<J.length;ce++){var ke=J[ce].split("=");if(ke.length>1){const Me=ke[0];ke=ke[1];const Et=Me.split("_");F=Et.length>=2&&Et[1]=="type"?F+(Me+"="+ke+"&"):F+(Me+"=redacted&")}}}else F=null;else F=D;return"XMLHTTP REQ ("+_+") [attempt "+k+"]: "+d+`
`+p+`
`+F})}function Iw(a,d,p,_,k,D,F){a.info(function(){return"XMLHTTP RESP ("+_+") [ attempt "+k+"]: "+d+`
`+p+`
`+D+" "+F})}function mr(a,d,p,_){a.info(function(){return"XMLHTTP TEXT ("+d+"): "+Aw(a,p)+(_?" "+_:"")})}function bw(a,d){a.info(function(){return"TIMEOUT: "+d})}is.prototype.info=function(){};function Aw(a,d){if(!a.g)return d;if(!d)return null;try{const D=JSON.parse(d);if(D){for(a=0;a<D.length;a++)if(Array.isArray(D[a])){var p=D[a];if(!(p.length<2)){var _=p[1];if(Array.isArray(_)&&!(_.length<1)){var k=_[0];if(k!="noop"&&k!="stop"&&k!="close")for(let F=1;F<_.length;F++)_[F]=""}}}}return Pa(D)}catch{return d}}var Ai={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},Th={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},Eh;function xa(){}f(xa,mh),xa.prototype.g=function(){return new XMLHttpRequest},Eh=new xa;function os(a){return encodeURIComponent(String(a))}function Rw(a){var d=1;a=a.split(":");const p=[];for(;d>0&&a.length;)p.push(a.shift()),d--;return a.length&&p.push(a.join(":")),p}function Xt(a,d,p,_){this.j=a,this.i=d,this.l=p,this.S=_||1,this.V=new ts(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new Ih}function Ih(){this.i=null,this.g="",this.h=!1}var bh={},Va={};function Da(a,d,p){a.M=1,a.A=Si(Tt(d)),a.u=p,a.R=!0,Ah(a,null)}function Ah(a,d){a.F=Date.now(),Ri(a),a.B=Tt(a.A);var p=a.B,_=a.S;Array.isArray(_)||(_=[String(_)]),Fh(p.i,"t",_),a.C=0,p=a.j.L,a.h=new Ih,a.g=nd(a.j,p?d:null,!a.u),a.P>0&&(a.O=new vw(u(a.Y,a,a.g),a.P)),d=a.V,p=a.g,_=a.ba;var k="readystatechange";Array.isArray(k)||(k&&(fh[0]=k.toString()),k=fh);for(let D=0;D<k.length;D++){const F=Ee(p,k[D],_||d.handleEvent,!1,d.h||d);if(!F)break;d.g[F.key]=F}d=a.J?ot(a.J):{},a.u?(a.v||(a.v="POST"),d["Content-Type"]="application/x-www-form-urlencoded",a.g.ea(a.B,a.v,a.u,d)):(a.v="GET",a.g.ea(a.B,a.v,null,d)),rs(),Ew(a.i,a.v,a.B,a.l,a.S,a.u)}Xt.prototype.ba=function(a){a=a.target;const d=this.O;d&&en(a)==3?d.j():this.Y(a)},Xt.prototype.Y=function(a){try{if(a==this.g)e:{const J=en(this.g),ke=this.g.ya(),ce=this.g.ca();if(!(J<3)&&(J!=3||this.g&&(this.h.h||this.g.la()||Wh(this.g)))){this.K||J!=4||ke==7||(ke==8||ce<=0?rs(3):rs(2)),Ma(this);var d=this.g.ca();this.X=d;var p=Sw(this);if(this.o=d==200,Iw(this.i,this.v,this.B,this.l,this.S,J,d),this.o){if(this.U&&!this.L){t:{if(this.g){var _,k=this.g;if((_=k.g?k.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!T(_)){var D=_;break t}}D=null}if(a=D)mr(this.i,this.l,a,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Na(this,a);else{this.o=!1,this.m=3,Ke(12),Un(this),as(this);break e}}if(this.R){a=!0;let Me;for(;!this.K&&this.C<p.length;)if(Me=Pw(this,p),Me==Va){J==4&&(this.m=4,Ke(14),a=!1),mr(this.i,this.l,null,"[Incomplete Response]");break}else if(Me==bh){this.m=4,Ke(15),mr(this.i,this.l,p,"[Invalid Chunk]"),a=!1;break}else mr(this.i,this.l,Me,null),Na(this,Me);if(Rh(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),J!=4||p.length!=0||this.h.h||(this.m=1,Ke(16),a=!1),this.o=this.o&&a,!a)mr(this.i,this.l,p,"[Invalid Chunked Response]"),Un(this),as(this);else if(p.length>0&&!this.W){this.W=!0;var F=this.j;F.g==this&&F.aa&&!F.P&&(F.j.info("Great, no buffering proxy detected. Bytes received: "+p.length),za(F),F.P=!0,Ke(11))}}else mr(this.i,this.l,p,null),Na(this,p);J==4&&Un(this),this.o&&!this.K&&(J==4?Jh(this.j,this):(this.o=!1,Ri(this)))}else $w(this.g),d==400&&p.indexOf("Unknown SID")>0?(this.m=3,Ke(12)):(this.m=0,Ke(13)),Un(this),as(this)}}}catch{}finally{}};function Sw(a){if(!Rh(a))return a.g.la();const d=Wh(a.g);if(d==="")return"";let p="";const _=d.length,k=en(a.g)==4;if(!a.h.i){if(typeof TextDecoder>"u")return Un(a),as(a),"";a.h.i=new o.TextDecoder}for(let D=0;D<_;D++)a.h.h=!0,p+=a.h.i.decode(d[D],{stream:!(k&&D==_-1)});return d.length=0,a.h.g+=p,a.C=0,a.h.g}function Rh(a){return a.g?a.v=="GET"&&a.M!=2&&a.j.Aa:!1}function Pw(a,d){var p=a.C,_=d.indexOf(`
`,p);return _==-1?Va:(p=Number(d.substring(p,_)),isNaN(p)?bh:(_+=1,_+p>d.length?Va:(d=d.slice(_,_+p),a.C=_+p,d)))}Xt.prototype.cancel=function(){this.K=!0,Un(this)};function Ri(a){a.T=Date.now()+a.H,Sh(a,a.H)}function Sh(a,d){if(a.D!=null)throw Error("WatchDog timer not null");a.D=ss(u(a.aa,a),d)}function Ma(a){a.D&&(o.clearTimeout(a.D),a.D=null)}Xt.prototype.aa=function(){this.D=null;const a=Date.now();a-this.T>=0?(bw(this.i,this.B),this.M!=2&&(rs(),Ke(17)),Un(this),this.m=2,as(this)):Sh(this,this.T-a)};function as(a){a.j.I==0||a.K||Jh(a.j,a)}function Un(a){Ma(a);var d=a.O;d&&typeof d.dispose=="function"&&d.dispose(),a.O=null,ph(a.V),a.g&&(d=a.g,a.g=null,d.abort(),d.dispose())}function Na(a,d){try{var p=a.j;if(p.I!=0&&(p.g==a||La(p.h,a))){if(!a.L&&La(p.h,a)&&p.I==3){try{var _=p.Ba.g.parse(d)}catch{_=null}if(Array.isArray(_)&&_.length==3){var k=_;if(k[0]==0){e:if(!p.v){if(p.g)if(p.g.F+3e3<a.F)Vi(p),ki(p);else break e;$a(p),Ke(18)}}else p.xa=k[1],0<p.xa-p.K&&k[2]<37500&&p.F&&p.A==0&&!p.C&&(p.C=ss(u(p.Va,p),6e3));kh(p.h)<=1&&p.ta&&(p.ta=void 0)}else jn(p,11)}else if((a.L||p.g==a)&&Vi(p),!T(d))for(k=p.Ba.g.parse(d),d=0;d<k.length;d++){let ce=k[d];const Me=ce[0];if(!(Me<=p.K))if(p.K=Me,ce=ce[1],p.I==2)if(ce[0]=="c"){p.M=ce[1],p.ba=ce[2];const Et=ce[3];Et!=null&&(p.ka=Et,p.j.info("VER="+p.ka));const $n=ce[4];$n!=null&&(p.za=$n,p.j.info("SVER="+p.za));const tn=ce[5];tn!=null&&typeof tn=="number"&&tn>0&&(_=1.5*tn,p.O=_,p.j.info("backChannelRequestTimeoutMs_="+_)),_=p;const nn=a.g;if(nn){const Mi=nn.g?nn.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Mi){var D=_.h;D.g||Mi.indexOf("spdy")==-1&&Mi.indexOf("quic")==-1&&Mi.indexOf("h2")==-1||(D.j=D.l,D.g=new Set,D.h&&(Oa(D,D.h),D.h=null))}if(_.G){const qa=nn.g?nn.g.getResponseHeader("X-HTTP-Session-Id"):null;qa&&(_.wa=qa,de(_.J,_.G,qa))}}p.I=3,p.l&&p.l.ra(),p.aa&&(p.T=Date.now()-a.F,p.j.info("Handshake RTT: "+p.T+"ms")),_=p;var F=a;if(_.na=td(_,_.L?_.ba:null,_.W),F.L){xh(_.h,F);var J=F,ke=_.O;ke&&(J.H=ke),J.D&&(Ma(J),Ri(J)),_.g=F}else Qh(_);p.i.length>0&&xi(p)}else ce[0]!="stop"&&ce[0]!="close"||jn(p,7);else p.I==3&&(ce[0]=="stop"||ce[0]=="close"?ce[0]=="stop"?jn(p,7):ja(p):ce[0]!="noop"&&p.l&&p.l.qa(ce),p.A=0)}}rs(4)}catch{}}var Cw=class{constructor(a,d){this.g=a,this.map=d}};function Ph(a){this.l=a||10,o.PerformanceNavigationTiming?(a=o.performance.getEntriesByType("navigation"),a=a.length>0&&(a[0].nextHopProtocol=="hq"||a[0].nextHopProtocol=="h2")):a=!!(o.chrome&&o.chrome.loadTimes&&o.chrome.loadTimes()&&o.chrome.loadTimes().wasFetchedViaSpdy),this.j=a?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function Ch(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function kh(a){return a.h?1:a.g?a.g.size:0}function La(a,d){return a.h?a.h==d:a.g?a.g.has(d):!1}function Oa(a,d){a.g?a.g.add(d):a.h=d}function xh(a,d){a.h&&a.h==d?a.h=null:a.g&&a.g.has(d)&&a.g.delete(d)}Ph.prototype.cancel=function(){if(this.i=Vh(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const a of this.g.values())a.cancel();this.g.clear()}};function Vh(a){if(a.h!=null)return a.i.concat(a.h.G);if(a.g!=null&&a.g.size!==0){let d=a.i;for(const p of a.g.values())d=d.concat(p.G);return d}return y(a.i)}var Dh=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function kw(a,d){if(a){a=a.split("&");for(let p=0;p<a.length;p++){const _=a[p].indexOf("=");let k,D=null;_>=0?(k=a[p].substring(0,_),D=a[p].substring(_+1)):k=a[p],d(k,D?decodeURIComponent(D.replace(/\+/g," ")):"")}}}function Jt(a){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let d;a instanceof Jt?(this.l=a.l,cs(this,a.j),this.o=a.o,this.g=a.g,ls(this,a.u),this.h=a.h,Fa(this,Uh(a.i)),this.m=a.m):a&&(d=String(a).match(Dh))?(this.l=!1,cs(this,d[1]||"",!0),this.o=us(d[2]||""),this.g=us(d[3]||"",!0),ls(this,d[4]),this.h=us(d[5]||"",!0),Fa(this,d[6]||"",!0),this.m=us(d[7]||"")):(this.l=!1,this.i=new ds(null,this.l))}Jt.prototype.toString=function(){const a=[];var d=this.j;d&&a.push(hs(d,Mh,!0),":");var p=this.g;return(p||d=="file")&&(a.push("//"),(d=this.o)&&a.push(hs(d,Mh,!0),"@"),a.push(os(p).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),p=this.u,p!=null&&a.push(":",String(p))),(p=this.h)&&(this.g&&p.charAt(0)!="/"&&a.push("/"),a.push(hs(p,p.charAt(0)=="/"?Dw:Vw,!0))),(p=this.i.toString())&&a.push("?",p),(p=this.m)&&a.push("#",hs(p,Nw)),a.join("")},Jt.prototype.resolve=function(a){const d=Tt(this);let p=!!a.j;p?cs(d,a.j):p=!!a.o,p?d.o=a.o:p=!!a.g,p?d.g=a.g:p=a.u!=null;var _=a.h;if(p)ls(d,a.u);else if(p=!!a.h){if(_.charAt(0)!="/")if(this.g&&!this.h)_="/"+_;else{var k=d.h.lastIndexOf("/");k!=-1&&(_=d.h.slice(0,k+1)+_)}if(k=_,k==".."||k==".")_="";else if(k.indexOf("./")!=-1||k.indexOf("/.")!=-1){_=k.lastIndexOf("/",0)==0,k=k.split("/");const D=[];for(let F=0;F<k.length;){const J=k[F++];J=="."?_&&F==k.length&&D.push(""):J==".."?((D.length>1||D.length==1&&D[0]!="")&&D.pop(),_&&F==k.length&&D.push("")):(D.push(J),_=!0)}_=D.join("/")}else _=k}return p?d.h=_:p=a.i.toString()!=="",p?Fa(d,Uh(a.i)):p=!!a.m,p&&(d.m=a.m),d};function Tt(a){return new Jt(a)}function cs(a,d,p){a.j=p?us(d,!0):d,a.j&&(a.j=a.j.replace(/:$/,""))}function ls(a,d){if(d){if(d=Number(d),isNaN(d)||d<0)throw Error("Bad port number "+d);a.u=d}else a.u=null}function Fa(a,d,p){d instanceof ds?(a.i=d,Lw(a.i,a.l)):(p||(d=hs(d,Mw)),a.i=new ds(d,a.l))}function de(a,d,p){a.i.set(d,p)}function Si(a){return de(a,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),a}function us(a,d){return a?d?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function hs(a,d,p){return typeof a=="string"?(a=encodeURI(a).replace(d,xw),p&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function xw(a){return a=a.charCodeAt(0),"%"+(a>>4&15).toString(16)+(a&15).toString(16)}var Mh=/[#\/\?@]/g,Vw=/[#\?:]/g,Dw=/[#\?]/g,Mw=/[#\?@]/g,Nw=/#/g;function ds(a,d){this.h=this.g=null,this.i=a||null,this.j=!!d}function Bn(a){a.g||(a.g=new Map,a.h=0,a.i&&kw(a.i,function(d,p){a.add(decodeURIComponent(d.replace(/\+/g," ")),p)}))}t=ds.prototype,t.add=function(a,d){Bn(this),this.i=null,a=gr(this,a);let p=this.g.get(a);return p||this.g.set(a,p=[]),p.push(d),this.h+=1,this};function Nh(a,d){Bn(a),d=gr(a,d),a.g.has(d)&&(a.i=null,a.h-=a.g.get(d).length,a.g.delete(d))}function Lh(a,d){return Bn(a),d=gr(a,d),a.g.has(d)}t.forEach=function(a,d){Bn(this),this.g.forEach(function(p,_){p.forEach(function(k){a.call(d,k,_,this)},this)},this)};function Oh(a,d){Bn(a);let p=[];if(typeof d=="string")Lh(a,d)&&(p=p.concat(a.g.get(gr(a,d))));else for(a=Array.from(a.g.values()),d=0;d<a.length;d++)p=p.concat(a[d]);return p}t.set=function(a,d){return Bn(this),this.i=null,a=gr(this,a),Lh(this,a)&&(this.h-=this.g.get(a).length),this.g.set(a,[d]),this.h+=1,this},t.get=function(a,d){return a?(a=Oh(this,a),a.length>0?String(a[0]):d):d};function Fh(a,d,p){Nh(a,d),p.length>0&&(a.i=null,a.g.set(gr(a,d),y(p)),a.h+=p.length)}t.toString=function(){if(this.i)return this.i;if(!this.g)return"";const a=[],d=Array.from(this.g.keys());for(let _=0;_<d.length;_++){var p=d[_];const k=os(p);p=Oh(this,p);for(let D=0;D<p.length;D++){let F=k;p[D]!==""&&(F+="="+os(p[D])),a.push(F)}}return this.i=a.join("&")};function Uh(a){const d=new ds;return d.i=a.i,a.g&&(d.g=new Map(a.g),d.h=a.h),d}function gr(a,d){return d=String(d),a.j&&(d=d.toLowerCase()),d}function Lw(a,d){d&&!a.j&&(Bn(a),a.i=null,a.g.forEach(function(p,_){const k=_.toLowerCase();_!=k&&(Nh(this,_),Fh(this,k,p))},a)),a.j=d}function Ow(a,d){const p=new is;if(o.Image){const _=new Image;_.onload=h(Zt,p,"TestLoadImage: loaded",!0,d,_),_.onerror=h(Zt,p,"TestLoadImage: error",!1,d,_),_.onabort=h(Zt,p,"TestLoadImage: abort",!1,d,_),_.ontimeout=h(Zt,p,"TestLoadImage: timeout",!1,d,_),o.setTimeout(function(){_.ontimeout&&_.ontimeout()},1e4),_.src=a}else d(!1)}function Fw(a,d){const p=new is,_=new AbortController,k=setTimeout(()=>{_.abort(),Zt(p,"TestPingServer: timeout",!1,d)},1e4);fetch(a,{signal:_.signal}).then(D=>{clearTimeout(k),D.ok?Zt(p,"TestPingServer: ok",!0,d):Zt(p,"TestPingServer: server error",!1,d)}).catch(()=>{clearTimeout(k),Zt(p,"TestPingServer: error",!1,d)})}function Zt(a,d,p,_,k){try{k&&(k.onload=null,k.onerror=null,k.onabort=null,k.ontimeout=null),_(p)}catch{}}function Uw(){this.g=new Tw}function Ua(a){this.i=a.Sb||null,this.h=a.ab||!1}f(Ua,mh),Ua.prototype.g=function(){return new Pi(this.i,this.h)};function Pi(a,d){$e.call(this),this.H=a,this.o=d,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}f(Pi,$e),t=Pi.prototype,t.open=function(a,d){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=a,this.D=d,this.readyState=1,ps(this)},t.send=function(a){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const d={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};a&&(d.body=a),(this.H||o).fetch(new Request(this.D,d)).then(this.Pa.bind(this),this.ga.bind(this))},t.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,fs(this)),this.readyState=0},t.Pa=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,ps(this)),this.g&&(this.readyState=3,ps(this),this.g)))if(this.responseType==="arraybuffer")a.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof o.ReadableStream<"u"&&"body"in a){if(this.j=a.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Bh(this)}else a.text().then(this.Oa.bind(this),this.ga.bind(this))};function Bh(a){a.j.read().then(a.Ma.bind(a)).catch(a.ga.bind(a))}t.Ma=function(a){if(this.g){if(this.o&&a.value)this.response.push(a.value);else if(!this.o){var d=a.value?a.value:new Uint8Array(0);(d=this.B.decode(d,{stream:!a.done}))&&(this.response=this.responseText+=d)}a.done?fs(this):ps(this),this.readyState==3&&Bh(this)}},t.Oa=function(a){this.g&&(this.response=this.responseText=a,fs(this))},t.Na=function(a){this.g&&(this.response=a,fs(this))},t.ga=function(){this.g&&fs(this)};function fs(a){a.readyState=4,a.l=null,a.j=null,a.B=null,ps(a)}t.setRequestHeader=function(a,d){this.A.append(a,d)},t.getResponseHeader=function(a){return this.h&&this.h.get(a.toLowerCase())||""},t.getAllResponseHeaders=function(){if(!this.h)return"";const a=[],d=this.h.entries();for(var p=d.next();!p.done;)p=p.value,a.push(p[0]+": "+p[1]),p=d.next();return a.join(`\r
`)};function ps(a){a.onreadystatechange&&a.onreadystatechange.call(a)}Object.defineProperty(Pi.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(a){this.m=a?"include":"same-origin"}});function jh(a){let d="";return Te(a,function(p,_){d+=_,d+=":",d+=p,d+=`\r
`}),d}function Ba(a,d,p){e:{for(_ in p){var _=!1;break e}_=!0}_||(p=jh(p),typeof a=="string"?p!=null&&os(p):de(a,d,p))}function ve(a){$e.call(this),this.headers=new Map,this.L=a||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}f(ve,$e);var Bw=/^https?$/i,jw=["POST","PUT"];t=ve.prototype,t.Fa=function(a){this.H=a},t.ea=function(a,d,p,_){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+a);d=d?d.toUpperCase():"GET",this.D=a,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():Eh.g(),this.g.onreadystatechange=m(u(this.Ca,this));try{this.B=!0,this.g.open(d,String(a),!0),this.B=!1}catch(D){$h(this,D);return}if(a=p||"",p=new Map(this.headers),_)if(Object.getPrototypeOf(_)===Object.prototype)for(var k in _)p.set(k,_[k]);else if(typeof _.keys=="function"&&typeof _.get=="function")for(const D of _.keys())p.set(D,_.get(D));else throw Error("Unknown input type for opt_headers: "+String(_));_=Array.from(p.keys()).find(D=>D.toLowerCase()=="content-type"),k=o.FormData&&a instanceof o.FormData,!(Array.prototype.indexOf.call(jw,d,void 0)>=0)||_||k||p.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[D,F]of p)this.g.setRequestHeader(D,F);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(a),this.v=!1}catch(D){$h(this,D)}};function $h(a,d){a.h=!1,a.g&&(a.j=!0,a.g.abort(),a.j=!1),a.l=d,a.o=5,zh(a),Ci(a)}function zh(a){a.A||(a.A=!0,Ge(a,"complete"),Ge(a,"error"))}t.abort=function(a){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=a||7,Ge(this,"complete"),Ge(this,"abort"),Ci(this))},t.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Ci(this,!0)),ve.Z.N.call(this)},t.Ca=function(){this.u||(this.B||this.v||this.j?qh(this):this.Xa())},t.Xa=function(){qh(this)};function qh(a){if(a.h&&typeof i<"u"){if(a.v&&en(a)==4)setTimeout(a.Ca.bind(a),0);else if(Ge(a,"readystatechange"),en(a)==4){a.h=!1;try{const D=a.ca();e:switch(D){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var d=!0;break e;default:d=!1}var p;if(!(p=d)){var _;if(_=D===0){let F=String(a.D).match(Dh)[1]||null;!F&&o.self&&o.self.location&&(F=o.self.location.protocol.slice(0,-1)),_=!Bw.test(F?F.toLowerCase():"")}p=_}if(p)Ge(a,"complete"),Ge(a,"success");else{a.o=6;try{var k=en(a)>2?a.g.statusText:""}catch{k=""}a.l=k+" ["+a.ca()+"]",zh(a)}}finally{Ci(a)}}}}function Ci(a,d){if(a.g){a.m&&(clearTimeout(a.m),a.m=null);const p=a.g;a.g=null,d||Ge(a,"ready");try{p.onreadystatechange=null}catch{}}}t.isActive=function(){return!!this.g};function en(a){return a.g?a.g.readyState:0}t.ca=function(){try{return en(this)>2?this.g.status:-1}catch{return-1}},t.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},t.La=function(a){if(this.g){var d=this.g.responseText;return a&&d.indexOf(a)==0&&(d=d.substring(a.length)),ww(d)}};function Wh(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.F){case"":case"text":return a.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch{return null}}function $w(a){const d={};a=(a.g&&en(a)>=2&&a.g.getAllResponseHeaders()||"").split(`\r
`);for(let _=0;_<a.length;_++){if(T(a[_]))continue;var p=Rw(a[_]);const k=p[0];if(p=p[1],typeof p!="string")continue;p=p.trim();const D=d[k]||[];d[k]=D,D.push(p)}H(d,function(_){return _.join(", ")})}t.ya=function(){return this.o},t.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function ms(a,d,p){return p&&p.internalChannelParams&&p.internalChannelParams[a]||d}function Hh(a){this.za=0,this.i=[],this.j=new is,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=ms("failFast",!1,a),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=ms("baseRetryDelayMs",5e3,a),this.Za=ms("retryDelaySeedMs",1e4,a),this.Ta=ms("forwardChannelMaxRetries",2,a),this.va=ms("forwardChannelRequestTimeoutMs",2e4,a),this.ma=a&&a.xmlHttpFactory||void 0,this.Ua=a&&a.Rb||void 0,this.Aa=a&&a.useFetchStreams||!1,this.O=void 0,this.L=a&&a.supportsCrossDomainXhr||!1,this.M="",this.h=new Ph(a&&a.concurrentRequestLimit),this.Ba=new Uw,this.S=a&&a.fastHandshake||!1,this.R=a&&a.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=a&&a.Pb||!1,a&&a.ua&&this.j.ua(),a&&a.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&a&&a.detectBufferingProxy||!1,this.ia=void 0,a&&a.longPollingTimeout&&a.longPollingTimeout>0&&(this.ia=a.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}t=Hh.prototype,t.ka=8,t.I=1,t.connect=function(a,d,p,_){Ke(0),this.W=a,this.H=d||{},p&&_!==void 0&&(this.H.OSID=p,this.H.OAID=_),this.F=this.X,this.J=td(this,null,this.W),xi(this)};function ja(a){if(Gh(a),a.I==3){var d=a.V++,p=Tt(a.J);if(de(p,"SID",a.M),de(p,"RID",d),de(p,"TYPE","terminate"),gs(a,p),d=new Xt(a,a.j,d),d.M=2,d.A=Si(Tt(p)),p=!1,o.navigator&&o.navigator.sendBeacon)try{p=o.navigator.sendBeacon(d.A.toString(),"")}catch{}!p&&o.Image&&(new Image().src=d.A,p=!0),p||(d.g=nd(d.j,null),d.g.ea(d.A)),d.F=Date.now(),Ri(d)}ed(a)}function ki(a){a.g&&(za(a),a.g.cancel(),a.g=null)}function Gh(a){ki(a),a.v&&(o.clearTimeout(a.v),a.v=null),Vi(a),a.h.cancel(),a.m&&(typeof a.m=="number"&&o.clearTimeout(a.m),a.m=null)}function xi(a){if(!Ch(a.h)&&!a.m){a.m=!0;var d=a.Ea;O||g(),z||(O(),z=!0),b.add(d,a),a.D=0}}function zw(a,d){return kh(a.h)>=a.h.j-(a.m?1:0)?!1:a.m?(a.i=d.G.concat(a.i),!0):a.I==1||a.I==2||a.D>=(a.Sa?0:a.Ta)?!1:(a.m=ss(u(a.Ea,a,d),Zh(a,a.D)),a.D++,!0)}t.Ea=function(a){if(this.m)if(this.m=null,this.I==1){if(!a){this.V=Math.floor(Math.random()*1e5),a=this.V++;const k=new Xt(this,this.j,a);let D=this.o;if(this.U&&(D?(D=ot(D),es(D,this.U)):D=this.U),this.u!==null||this.R||(k.J=D,D=null),this.S)e:{for(var d=0,p=0;p<this.i.length;p++){t:{var _=this.i[p];if("__data__"in _.map&&(_=_.map.__data__,typeof _=="string")){_=_.length;break t}_=void 0}if(_===void 0)break;if(d+=_,d>4096){d=p;break e}if(d===4096||p===this.i.length-1){d=p+1;break e}}d=1e3}else d=1e3;d=Yh(this,k,d),p=Tt(this.J),de(p,"RID",a),de(p,"CVER",22),this.G&&de(p,"X-HTTP-Session-Id",this.G),gs(this,p),D&&(this.R?d="headers="+os(jh(D))+"&"+d:this.u&&Ba(p,this.u,D)),Oa(this.h,k),this.Ra&&de(p,"TYPE","init"),this.S?(de(p,"$req",d),de(p,"SID","null"),k.U=!0,Da(k,p,null)):Da(k,p,d),this.I=2}}else this.I==3&&(a?Kh(this,a):this.i.length==0||Ch(this.h)||Kh(this))};function Kh(a,d){var p;d?p=d.l:p=a.V++;const _=Tt(a.J);de(_,"SID",a.M),de(_,"RID",p),de(_,"AID",a.K),gs(a,_),a.u&&a.o&&Ba(_,a.u,a.o),p=new Xt(a,a.j,p,a.D+1),a.u===null&&(p.J=a.o),d&&(a.i=d.G.concat(a.i)),d=Yh(a,p,1e3),p.H=Math.round(a.va*.5)+Math.round(a.va*.5*Math.random()),Oa(a.h,p),Da(p,_,d)}function gs(a,d){a.H&&Te(a.H,function(p,_){de(d,_,p)}),a.l&&Te({},function(p,_){de(d,_,p)})}function Yh(a,d,p){p=Math.min(a.i.length,p);const _=a.l?u(a.l.Ka,a.l,a):null;e:{var k=a.i;let J=-1;for(;;){const ke=["count="+p];J==-1?p>0?(J=k[0].g,ke.push("ofs="+J)):J=0:ke.push("ofs="+J);let ce=!0;for(let Me=0;Me<p;Me++){var D=k[Me].g;const Et=k[Me].map;if(D-=J,D<0)J=Math.max(0,k[Me].g-100),ce=!1;else try{D="req"+D+"_"||"";try{var F=Et instanceof Map?Et:Object.entries(Et);for(const[$n,tn]of F){let nn=tn;c(tn)&&(nn=Pa(tn)),ke.push(D+$n+"="+encodeURIComponent(nn))}}catch($n){throw ke.push(D+"type="+encodeURIComponent("_badmap")),$n}}catch{_&&_(Et)}}if(ce){F=ke.join("&");break e}}F=void 0}return a=a.i.splice(0,p),d.G=a,F}function Qh(a){if(!a.g&&!a.v){a.Y=1;var d=a.Da;O||g(),z||(O(),z=!0),b.add(d,a),a.A=0}}function $a(a){return a.g||a.v||a.A>=3?!1:(a.Y++,a.v=ss(u(a.Da,a),Zh(a,a.A)),a.A++,!0)}t.Da=function(){if(this.v=null,Xh(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var a=4*this.T;this.j.info("BP detection timer enabled: "+a),this.B=ss(u(this.Wa,this),a)}},t.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,Ke(10),ki(this),Xh(this))};function za(a){a.B!=null&&(o.clearTimeout(a.B),a.B=null)}function Xh(a){a.g=new Xt(a,a.j,"rpc",a.Y),a.u===null&&(a.g.J=a.o),a.g.P=0;var d=Tt(a.na);de(d,"RID","rpc"),de(d,"SID",a.M),de(d,"AID",a.K),de(d,"CI",a.F?"0":"1"),!a.F&&a.ia&&de(d,"TO",a.ia),de(d,"TYPE","xmlhttp"),gs(a,d),a.u&&a.o&&Ba(d,a.u,a.o),a.O&&(a.g.H=a.O);var p=a.g;a=a.ba,p.M=1,p.A=Si(Tt(d)),p.u=null,p.R=!0,Ah(p,a)}t.Va=function(){this.C!=null&&(this.C=null,ki(this),$a(this),Ke(19))};function Vi(a){a.C!=null&&(o.clearTimeout(a.C),a.C=null)}function Jh(a,d){var p=null;if(a.g==d){Vi(a),za(a),a.g=null;var _=2}else if(La(a.h,d))p=d.G,xh(a.h,d),_=1;else return;if(a.I!=0){if(d.o)if(_==1){p=d.u?d.u.length:0,d=Date.now()-d.F;var k=a.D;_=bi(),Ge(_,new wh(_,p)),xi(a)}else Qh(a);else if(k=d.m,k==3||k==0&&d.X>0||!(_==1&&zw(a,d)||_==2&&$a(a)))switch(p&&p.length>0&&(d=a.h,d.i=d.i.concat(p)),k){case 1:jn(a,5);break;case 4:jn(a,10);break;case 3:jn(a,6);break;default:jn(a,2)}}}function Zh(a,d){let p=a.Qa+Math.floor(Math.random()*a.Za);return a.isActive()||(p*=2),p*d}function jn(a,d){if(a.j.info("Error code "+d),d==2){var p=u(a.bb,a),_=a.Ua;const k=!_;_=new Jt(_||"//www.google.com/images/cleardot.gif"),o.location&&o.location.protocol=="http"||cs(_,"https"),Si(_),k?Ow(_.toString(),p):Fw(_.toString(),p)}else Ke(2);a.I=0,a.l&&a.l.pa(d),ed(a),Gh(a)}t.bb=function(a){a?(this.j.info("Successfully pinged google.com"),Ke(2)):(this.j.info("Failed to ping google.com"),Ke(1))};function ed(a){if(a.I=0,a.ja=[],a.l){const d=Vh(a.h);(d.length!=0||a.i.length!=0)&&(w(a.ja,d),w(a.ja,a.i),a.h.i.length=0,y(a.i),a.i.length=0),a.l.oa()}}function td(a,d,p){var _=p instanceof Jt?Tt(p):new Jt(p);if(_.g!="")d&&(_.g=d+"."+_.g),ls(_,_.u);else{var k=o.location;_=k.protocol,d=d?d+"."+k.hostname:k.hostname,k=+k.port;const D=new Jt(null);_&&cs(D,_),d&&(D.g=d),k&&ls(D,k),p&&(D.h=p),_=D}return p=a.G,d=a.wa,p&&d&&de(_,p,d),de(_,"VER",a.ka),gs(a,_),_}function nd(a,d,p){if(d&&!a.L)throw Error("Can't create secondary domain capable XhrIo object.");return d=a.Aa&&!a.ma?new ve(new Ua({ab:p})):new ve(a.ma),d.Fa(a.L),d}t.isActive=function(){return!!this.l&&this.l.isActive(this)};function rd(){}t=rd.prototype,t.ra=function(){},t.qa=function(){},t.pa=function(){},t.oa=function(){},t.isActive=function(){return!0},t.Ka=function(){};function Di(){}Di.prototype.g=function(a,d){return new tt(a,d)};function tt(a,d){$e.call(this),this.g=new Hh(d),this.l=a,this.h=d&&d.messageUrlParams||null,a=d&&d.messageHeaders||null,d&&d.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"}),this.g.o=a,a=d&&d.initMessageHeaders||null,d&&d.messageContentType&&(a?a["X-WebChannel-Content-Type"]=d.messageContentType:a={"X-WebChannel-Content-Type":d.messageContentType}),d&&d.sa&&(a?a["X-WebChannel-Client-Profile"]=d.sa:a={"X-WebChannel-Client-Profile":d.sa}),this.g.U=a,(a=d&&d.Qb)&&!T(a)&&(this.g.u=a),this.A=d&&d.supportsCrossDomainXhr||!1,this.v=d&&d.sendRawJson||!1,(d=d&&d.httpSessionIdParam)&&!T(d)&&(this.g.G=d,a=this.h,a!==null&&d in a&&(a=this.h,d in a&&delete a[d])),this.j=new yr(this)}f(tt,$e),tt.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},tt.prototype.close=function(){ja(this.g)},tt.prototype.o=function(a){var d=this.g;if(typeof a=="string"){var p={};p.__data__=a,a=p}else this.v&&(p={},p.__data__=Pa(a),a=p);d.i.push(new Cw(d.Ya++,a)),d.I==3&&xi(d)},tt.prototype.N=function(){this.g.l=null,delete this.j,ja(this.g),delete this.g,tt.Z.N.call(this)};function sd(a){Ca.call(this),a.__headers__&&(this.headers=a.__headers__,this.statusCode=a.__status__,delete a.__headers__,delete a.__status__);var d=a.__sm__;if(d){e:{for(const p in d){a=p;break e}a=void 0}(this.i=a)&&(a=this.i,d=d!==null&&a in d?d[a]:void 0),this.data=d}else this.data=a}f(sd,Ca);function id(){ka.call(this),this.status=1}f(id,ka);function yr(a){this.g=a}f(yr,rd),yr.prototype.ra=function(){Ge(this.g,"a")},yr.prototype.qa=function(a){Ge(this.g,new sd(a))},yr.prototype.pa=function(a){Ge(this.g,new id)},yr.prototype.oa=function(){Ge(this.g,"b")},Di.prototype.createWebChannel=Di.prototype.g,tt.prototype.send=tt.prototype.o,tt.prototype.open=tt.prototype.m,tt.prototype.close=tt.prototype.close,o_=function(){return new Di},i_=function(){return bi()},s_=Fn,ol={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},Ai.NO_ERROR=0,Ai.TIMEOUT=8,Ai.HTTP_ERROR=6,oo=Ai,Th.COMPLETE="complete",r_=Th,gh.EventType=ns,ns.OPEN="a",ns.CLOSE="b",ns.ERROR="c",ns.MESSAGE="d",$e.prototype.listen=$e.prototype.J,bs=gh,ve.prototype.listenOnce=ve.prototype.K,ve.prototype.getLastError=ve.prototype.Ha,ve.prototype.getLastErrorCode=ve.prototype.ya,ve.prototype.getStatus=ve.prototype.ca,ve.prototype.getResponseJson=ve.prototype.La,ve.prototype.getResponseText=ve.prototype.la,ve.prototype.send=ve.prototype.ea,ve.prototype.setWithCredentials=ve.prototype.Fa,n_=ve}).apply(typeof qi<"u"?qi:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qe{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}qe.UNAUTHENTICATED=new qe(null),qe.GOOGLE_CREDENTIALS=new qe("google-credentials-uid"),qe.FIRST_PARTY=new qe("first-party-uid"),qe.MOCK_USER=new qe("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Hr="12.11.0";function g1(t){Hr=t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const sr=new du("@firebase/firestore");function vr(){return sr.logLevel}function B(t,...e){if(sr.logLevel<=ee.DEBUG){const n=e.map(mu);sr.debug(`Firestore (${Hr}): ${t}`,...n)}}function Ht(t,...e){if(sr.logLevel<=ee.ERROR){const n=e.map(mu);sr.error(`Firestore (${Hr}): ${t}`,...n)}}function ir(t,...e){if(sr.logLevel<=ee.WARN){const n=e.map(mu);sr.warn(`Firestore (${Hr}): ${t}`,...n)}}function mu(t){if(typeof t=="string")return t;try{return(function(n){return JSON.stringify(n)})(t)}catch{return t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function K(t,e,n){let r="Unexpected state";typeof e=="string"?r=e:n=e,a_(t,r,n)}function a_(t,e,n){let r=`FIRESTORE (${Hr}) INTERNAL ASSERTION FAILED: ${e} (ID: ${t.toString(16)})`;if(n!==void 0)try{r+=" CONTEXT: "+JSON.stringify(n)}catch{r+=" CONTEXT: "+n}throw Ht(r),new Error(r)}function oe(t,e,n,r){let s="Unexpected state";typeof n=="string"?s=n:r=n,t||a_(e,s,r)}function X(t,e){return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const M={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class U extends Ot{constructor(e,n){super(e,n),this.code=e,this.message=n,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $t{constructor(){this.promise=new Promise(((e,n)=>{this.resolve=e,this.reject=n}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class c_{constructor(e,n){this.user=n,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class y1{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,n){e.enqueueRetryable((()=>n(qe.UNAUTHENTICATED)))}shutdown(){}}class _1{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,n){this.changeListener=n,e.enqueueRetryable((()=>n(this.token.user)))}shutdown(){this.changeListener=null}}class v1{constructor(e){this.t=e,this.currentUser=qe.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,n){oe(this.o===void 0,42304);let r=this.i;const s=l=>this.i!==r?(r=this.i,n(l)):Promise.resolve();let i=new $t;this.o=()=>{this.i++,this.currentUser=this.u(),i.resolve(),i=new $t,e.enqueueRetryable((()=>s(this.currentUser)))};const o=()=>{const l=i;e.enqueueRetryable((async()=>{await l.promise,await s(this.currentUser)}))},c=l=>{B("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=l,this.o&&(this.auth.addAuthTokenListener(this.o),o())};this.t.onInit((l=>c(l))),setTimeout((()=>{if(!this.auth){const l=this.t.getImmediate({optional:!0});l?c(l):(B("FirebaseAuthCredentialsProvider","Auth not yet detected"),i.resolve(),i=new $t)}}),0),o()}getToken(){const e=this.i,n=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(n).then((r=>this.i!==e?(B("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(oe(typeof r.accessToken=="string",31837,{l:r}),new c_(r.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return oe(e===null||typeof e=="string",2055,{h:e}),new qe(e)}}class w1{constructor(e,n,r){this.P=e,this.T=n,this.I=r,this.type="FirstParty",this.user=qe.FIRST_PARTY,this.R=new Map}A(){return this.I?this.I():null}get headers(){this.R.set("X-Goog-AuthUser",this.P);const e=this.A();return e&&this.R.set("Authorization",e),this.T&&this.R.set("X-Goog-Iam-Authorization-Token",this.T),this.R}}class T1{constructor(e,n,r){this.P=e,this.T=n,this.I=r}getToken(){return Promise.resolve(new w1(this.P,this.T,this.I))}start(e,n){e.enqueueRetryable((()=>n(qe.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class tp{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class E1{constructor(e,n){this.V=n,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,nt(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,n){oe(this.o===void 0,3512);const r=i=>{i.error!=null&&B("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${i.error.message}`);const o=i.token!==this.m;return this.m=i.token,B("FirebaseAppCheckTokenProvider",`Received ${o?"new":"existing"} token.`),o?n(i.token):Promise.resolve()};this.o=i=>{e.enqueueRetryable((()=>r(i)))};const s=i=>{B("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=i,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit((i=>s(i))),setTimeout((()=>{if(!this.appCheck){const i=this.V.getImmediate({optional:!0});i?s(i):B("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){if(this.p)return Promise.resolve(new tp(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((n=>n?(oe(typeof n.token=="string",44558,{tokenResult:n}),this.m=n.token,new tp(n.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function I1(t){const e=typeof self<"u"&&(self.crypto||self.msCrypto),n=new Uint8Array(t);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(n);else for(let r=0;r<t;r++)n[r]=Math.floor(256*Math.random());return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gu{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",n=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const s=I1(40);for(let i=0;i<s.length;++i)r.length<20&&s[i]<n&&(r+=e.charAt(s[i]%62))}return r}}function te(t,e){return t<e?-1:t>e?1:0}function al(t,e){const n=Math.min(t.length,e.length);for(let r=0;r<n;r++){const s=t.charAt(r),i=e.charAt(r);if(s!==i)return vc(s)===vc(i)?te(s,i):vc(s)?1:-1}return te(t.length,e.length)}const b1=55296,A1=57343;function vc(t){const e=t.charCodeAt(0);return e>=b1&&e<=A1}function Vr(t,e,n){return t.length===e.length&&t.every(((r,s)=>n(r,e[s])))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const np="__name__";class bt{constructor(e,n,r){n===void 0?n=0:n>e.length&&K(637,{offset:n,range:e.length}),r===void 0?r=e.length-n:r>e.length-n&&K(1746,{length:r,range:e.length-n}),this.segments=e,this.offset=n,this.len=r}get length(){return this.len}isEqual(e){return bt.comparator(this,e)===0}child(e){const n=this.segments.slice(this.offset,this.limit());return e instanceof bt?e.forEach((r=>{n.push(r)})):n.push(e),this.construct(n)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let n=0;n<this.length;n++)if(this.get(n)!==e.get(n))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let n=0;n<this.length;n++)if(this.get(n)!==e.get(n))return!1;return!0}forEach(e){for(let n=this.offset,r=this.limit();n<r;n++)e(this.segments[n])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,n){const r=Math.min(e.length,n.length);for(let s=0;s<r;s++){const i=bt.compareSegments(e.get(s),n.get(s));if(i!==0)return i}return te(e.length,n.length)}static compareSegments(e,n){const r=bt.isNumericId(e),s=bt.isNumericId(n);return r&&!s?-1:!r&&s?1:r&&s?bt.extractNumericId(e).compare(bt.extractNumericId(n)):al(e,n)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return yn.fromString(e.substring(4,e.length-2))}}class ue extends bt{construct(e,n,r){return new ue(e,n,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const n=[];for(const r of e){if(r.indexOf("//")>=0)throw new U(M.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);n.push(...r.split("/").filter((s=>s.length>0)))}return new ue(n)}static emptyPath(){return new ue([])}}const R1=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class Ue extends bt{construct(e,n,r){return new Ue(e,n,r)}static isValidIdentifier(e){return R1.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),Ue.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===np}static keyField(){return new Ue([np])}static fromServerFormat(e){const n=[];let r="",s=0;const i=()=>{if(r.length===0)throw new U(M.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);n.push(r),r=""};let o=!1;for(;s<e.length;){const c=e[s];if(c==="\\"){if(s+1===e.length)throw new U(M.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const l=e[s+1];if(l!=="\\"&&l!=="."&&l!=="`")throw new U(M.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=l,s+=2}else c==="`"?(o=!o,s++):c!=="."||o?(r+=c,s++):(i(),s++)}if(i(),o)throw new U(M.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new Ue(n)}static emptyPath(){return new Ue([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class G{constructor(e){this.path=e}static fromPath(e){return new G(ue.fromString(e))}static fromName(e){return new G(ue.fromString(e).popFirst(5))}static empty(){return new G(ue.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&ue.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,n){return ue.comparator(e.path,n.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new G(new ue(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function l_(t,e,n){if(!n)throw new U(M.INVALID_ARGUMENT,`Function ${t}() cannot be called with an empty ${e}.`)}function S1(t,e,n,r){if(e===!0&&r===!0)throw new U(M.INVALID_ARGUMENT,`${t} and ${n} cannot be used together.`)}function rp(t){if(!G.isDocumentKey(t))throw new U(M.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${t} has ${t.length}.`)}function sp(t){if(G.isDocumentKey(t))throw new U(M.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${t} has ${t.length}.`)}function u_(t){return typeof t=="object"&&t!==null&&(Object.getPrototypeOf(t)===Object.prototype||Object.getPrototypeOf(t)===null)}function ia(t){if(t===void 0)return"undefined";if(t===null)return"null";if(typeof t=="string")return t.length>20&&(t=`${t.substring(0,20)}...`),JSON.stringify(t);if(typeof t=="number"||typeof t=="boolean")return""+t;if(typeof t=="object"){if(t instanceof Array)return"an array";{const e=(function(r){return r.constructor?r.constructor.name:null})(t);return e?`a custom ${e} object`:"an object"}}return typeof t=="function"?"a function":K(12329,{type:typeof t})}function Be(t,e){if("_delegate"in t&&(t=t._delegate),!(t instanceof e)){if(e.name===t.constructor.name)throw new U(M.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const n=ia(t);throw new U(M.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${n}`)}}return t}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Se(t,e){const n={typeString:t};return e&&(n.value=e),n}function ui(t,e){if(!u_(t))throw new U(M.INVALID_ARGUMENT,"JSON must be an object");let n;for(const r in e)if(e[r]){const s=e[r].typeString,i="value"in e[r]?{value:e[r].value}:void 0;if(!(r in t)){n=`JSON missing required field: '${r}'`;break}const o=t[r];if(s&&typeof o!==s){n=`JSON field '${r}' must be a ${s}.`;break}if(i!==void 0&&o!==i.value){n=`Expected '${r}' field to equal '${i.value}'`;break}}if(n)throw new U(M.INVALID_ARGUMENT,n);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ip=-62135596800,op=1e6;class fe{static now(){return fe.fromMillis(Date.now())}static fromDate(e){return fe.fromMillis(e.getTime())}static fromMillis(e){const n=Math.floor(e/1e3),r=Math.floor((e-1e3*n)*op);return new fe(n,r)}constructor(e,n){if(this.seconds=e,this.nanoseconds=n,n<0)throw new U(M.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+n);if(n>=1e9)throw new U(M.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+n);if(e<ip)throw new U(M.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new U(M.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/op}_compareTo(e){return this.seconds===e.seconds?te(this.nanoseconds,e.nanoseconds):te(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:fe._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(ui(e,fe._jsonSchema))return new fe(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-ip;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}fe._jsonSchemaVersion="firestore/timestamp/1.0",fe._jsonSchema={type:Se("string",fe._jsonSchemaVersion),seconds:Se("number"),nanoseconds:Se("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Q{static fromTimestamp(e){return new Q(e)}static min(){return new Q(new fe(0,0))}static max(){return new Q(new fe(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hs=-1;function P1(t,e){const n=t.toTimestamp().seconds,r=t.toTimestamp().nanoseconds+1,s=Q.fromTimestamp(r===1e9?new fe(n+1,0):new fe(n,r));return new En(s,G.empty(),e)}function C1(t){return new En(t.readTime,t.key,Hs)}class En{constructor(e,n,r){this.readTime=e,this.documentKey=n,this.largestBatchId=r}static min(){return new En(Q.min(),G.empty(),Hs)}static max(){return new En(Q.max(),G.empty(),Hs)}}function k1(t,e){let n=t.readTime.compareTo(e.readTime);return n!==0?n:(n=G.comparator(t.documentKey,e.documentKey),n!==0?n:te(t.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const x1="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class V1{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Gr(t){if(t.code!==M.FAILED_PRECONDITION||t.message!==x1)throw t;B("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class N{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((n=>{this.isDone=!0,this.result=n,this.nextCallback&&this.nextCallback(n)}),(n=>{this.isDone=!0,this.error=n,this.catchCallback&&this.catchCallback(n)}))}catch(e){return this.next(void 0,e)}next(e,n){return this.callbackAttached&&K(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(n,this.error):this.wrapSuccess(e,this.result):new N(((r,s)=>{this.nextCallback=i=>{this.wrapSuccess(e,i).next(r,s)},this.catchCallback=i=>{this.wrapFailure(n,i).next(r,s)}}))}toPromise(){return new Promise(((e,n)=>{this.next(e,n)}))}wrapUserFunction(e){try{const n=e();return n instanceof N?n:N.resolve(n)}catch(n){return N.reject(n)}}wrapSuccess(e,n){return e?this.wrapUserFunction((()=>e(n))):N.resolve(n)}wrapFailure(e,n){return e?this.wrapUserFunction((()=>e(n))):N.reject(n)}static resolve(e){return new N(((n,r)=>{n(e)}))}static reject(e){return new N(((n,r)=>{r(e)}))}static waitFor(e){return new N(((n,r)=>{let s=0,i=0,o=!1;e.forEach((c=>{++s,c.next((()=>{++i,o&&i===s&&n()}),(l=>r(l)))})),o=!0,i===s&&n()}))}static or(e){let n=N.resolve(!1);for(const r of e)n=n.next((s=>s?N.resolve(s):r()));return n}static forEach(e,n){const r=[];return e.forEach(((s,i)=>{r.push(n.call(this,s,i))})),this.waitFor(r)}static mapArray(e,n){return new N(((r,s)=>{const i=e.length,o=new Array(i);let c=0;for(let l=0;l<i;l++){const u=l;n(e[u]).next((h=>{o[u]=h,++c,c===i&&r(o)}),(h=>s(h)))}}))}static doWhile(e,n){return new N(((r,s)=>{const i=()=>{e()===!0?n().next((()=>{i()}),s):r()};i()}))}}function D1(t){const e=t.match(/Android ([\d.]+)/i),n=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(n)}function Kr(t){return t.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oa{constructor(e,n){this.previousValue=e,n&&(n.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>n.writeSequenceNumber(r))}ae(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ue&&this.ue(e),e}}oa.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yu=-1;function aa(t){return t==null}function ko(t){return t===0&&1/t==-1/0}function M1(t){return typeof t=="number"&&Number.isInteger(t)&&!ko(t)&&t<=Number.MAX_SAFE_INTEGER&&t>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const h_="";function N1(t){let e="";for(let n=0;n<t.length;n++)e.length>0&&(e=ap(e)),e=L1(t.get(n),e);return ap(e)}function L1(t,e){let n=e;const r=t.length;for(let s=0;s<r;s++){const i=t.charAt(s);switch(i){case"\0":n+="";break;case h_:n+="";break;default:n+=i}}return n}function ap(t){return t+h_+""}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cp(t){let e=0;for(const n in t)Object.prototype.hasOwnProperty.call(t,n)&&e++;return e}function xn(t,e){for(const n in t)Object.prototype.hasOwnProperty.call(t,n)&&e(n,t[n])}function d_(t){for(const e in t)if(Object.prototype.hasOwnProperty.call(t,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _e{constructor(e,n){this.comparator=e,this.root=n||Fe.EMPTY}insert(e,n){return new _e(this.comparator,this.root.insert(e,n,this.comparator).copy(null,null,Fe.BLACK,null,null))}remove(e){return new _e(this.comparator,this.root.remove(e,this.comparator).copy(null,null,Fe.BLACK,null,null))}get(e){let n=this.root;for(;!n.isEmpty();){const r=this.comparator(e,n.key);if(r===0)return n.value;r<0?n=n.left:r>0&&(n=n.right)}return null}indexOf(e){let n=0,r=this.root;for(;!r.isEmpty();){const s=this.comparator(e,r.key);if(s===0)return n+r.left.size;s<0?r=r.left:(n+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((n,r)=>(e(n,r),!1)))}toString(){const e=[];return this.inorderTraversal(((n,r)=>(e.push(`${n}:${r}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Wi(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Wi(this.root,e,this.comparator,!1)}getReverseIterator(){return new Wi(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Wi(this.root,e,this.comparator,!0)}}class Wi{constructor(e,n,r,s){this.isReverse=s,this.nodeStack=[];let i=1;for(;!e.isEmpty();)if(i=n?r(e.key,n):1,n&&s&&(i*=-1),i<0)e=this.isReverse?e.left:e.right;else{if(i===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const n={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return n}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class Fe{constructor(e,n,r,s,i){this.key=e,this.value=n,this.color=r??Fe.RED,this.left=s??Fe.EMPTY,this.right=i??Fe.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,n,r,s,i){return new Fe(e??this.key,n??this.value,r??this.color,s??this.left,i??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,n,r){let s=this;const i=r(e,s.key);return s=i<0?s.copy(null,null,null,s.left.insert(e,n,r),null):i===0?s.copy(null,n,null,null,null):s.copy(null,null,null,null,s.right.insert(e,n,r)),s.fixUp()}removeMin(){if(this.left.isEmpty())return Fe.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,n){let r,s=this;if(n(e,s.key)<0)s.left.isEmpty()||s.left.isRed()||s.left.left.isRed()||(s=s.moveRedLeft()),s=s.copy(null,null,null,s.left.remove(e,n),null);else{if(s.left.isRed()&&(s=s.rotateRight()),s.right.isEmpty()||s.right.isRed()||s.right.left.isRed()||(s=s.moveRedRight()),n(e,s.key)===0){if(s.right.isEmpty())return Fe.EMPTY;r=s.right.min(),s=s.copy(r.key,r.value,null,null,s.right.removeMin())}s=s.copy(null,null,null,null,s.right.remove(e,n))}return s.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,Fe.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,Fe.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),n=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,n)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw K(43730,{key:this.key,value:this.value});if(this.right.isRed())throw K(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw K(27949);return e+(this.isRed()?0:1)}}Fe.EMPTY=null,Fe.RED=!0,Fe.BLACK=!1;Fe.EMPTY=new class{constructor(){this.size=0}get key(){throw K(57766)}get value(){throw K(16141)}get color(){throw K(16727)}get left(){throw K(29726)}get right(){throw K(36894)}copy(e,n,r,s,i){return this}insert(e,n,r){return new Fe(e,n)}remove(e,n){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class De{constructor(e){this.comparator=e,this.data=new _e(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((n,r)=>(e(n),!1)))}forEachInRange(e,n){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const s=r.getNext();if(this.comparator(s.key,e[1])>=0)return;n(s.key)}}forEachWhile(e,n){let r;for(r=n!==void 0?this.data.getIteratorFrom(n):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const n=this.data.getIteratorFrom(e);return n.hasNext()?n.getNext().key:null}getIterator(){return new lp(this.data.getIterator())}getIteratorFrom(e){return new lp(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let n=this;return n.size<e.size&&(n=e,e=this),e.forEach((r=>{n=n.add(r)})),n}isEqual(e){if(!(e instanceof De)||this.size!==e.size)return!1;const n=this.data.getIterator(),r=e.data.getIterator();for(;n.hasNext();){const s=n.getNext().key,i=r.getNext().key;if(this.comparator(s,i)!==0)return!1}return!0}toArray(){const e=[];return this.forEach((n=>{e.push(n)})),e}toString(){const e=[];return this.forEach((n=>e.push(n))),"SortedSet("+e.toString()+")"}copy(e){const n=new De(this.comparator);return n.data=e,n}}class lp{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rt{constructor(e){this.fields=e,e.sort(Ue.comparator)}static empty(){return new rt([])}unionWith(e){let n=new De(Ue.comparator);for(const r of this.fields)n=n.add(r);for(const r of e)n=n.add(r);return new rt(n.toArray())}covers(e){for(const n of this.fields)if(n.isPrefixOf(e))return!0;return!1}isEqual(e){return Vr(this.fields,e.fields,((n,r)=>n.isEqual(r)))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class f_ extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class je{constructor(e){this.binaryString=e}static fromBase64String(e){const n=(function(s){try{return atob(s)}catch(i){throw typeof DOMException<"u"&&i instanceof DOMException?new f_("Invalid base64 string: "+i):i}})(e);return new je(n)}static fromUint8Array(e){const n=(function(s){let i="";for(let o=0;o<s.length;++o)i+=String.fromCharCode(s[o]);return i})(e);return new je(n)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(n){return btoa(n)})(this.binaryString)}toUint8Array(){return(function(n){const r=new Uint8Array(n.length);for(let s=0;s<n.length;s++)r[s]=n.charCodeAt(s);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return te(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}je.EMPTY_BYTE_STRING=new je("");const O1=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function In(t){if(oe(!!t,39018),typeof t=="string"){let e=0;const n=O1.exec(t);if(oe(!!n,46558,{timestamp:t}),n[1]){let s=n[1];s=(s+"000000000").substr(0,9),e=Number(s)}const r=new Date(t);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:Ie(t.seconds),nanos:Ie(t.nanos)}}function Ie(t){return typeof t=="number"?t:typeof t=="string"?Number(t):0}function bn(t){return typeof t=="string"?je.fromBase64String(t):je.fromUint8Array(t)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const p_="server_timestamp",m_="__type__",g_="__previous_value__",y_="__local_write_time__";function _u(t){var n,r;return((r=(((n=t==null?void 0:t.mapValue)==null?void 0:n.fields)||{})[m_])==null?void 0:r.stringValue)===p_}function ca(t){const e=t.mapValue.fields[g_];return _u(e)?ca(e):e}function Gs(t){const e=In(t.mapValue.fields[y_].timestampValue);return new fe(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class F1{constructor(e,n,r,s,i,o,c,l,u,h,f){this.databaseId=e,this.appId=n,this.persistenceKey=r,this.host=s,this.ssl=i,this.forceLongPolling=o,this.autoDetectLongPolling=c,this.longPollingOptions=l,this.useFetchStreams=u,this.isUsingEmulator=h,this.apiKey=f}}const xo="(default)";class Ks{constructor(e,n){this.projectId=e,this.database=n||xo}static empty(){return new Ks("","")}get isDefaultDatabase(){return this.database===xo}isEqual(e){return e instanceof Ks&&e.projectId===this.projectId&&e.database===this.database}}function U1(t,e){if(!Object.prototype.hasOwnProperty.apply(t.options,["projectId"]))throw new U(M.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Ks(t.options.projectId,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const __="__type__",B1="__max__",Hi={mapValue:{}},v_="__vector__",Vo="value";function An(t){return"nullValue"in t?0:"booleanValue"in t?1:"integerValue"in t||"doubleValue"in t?2:"timestampValue"in t?3:"stringValue"in t?5:"bytesValue"in t?6:"referenceValue"in t?7:"geoPointValue"in t?8:"arrayValue"in t?9:"mapValue"in t?_u(t)?4:$1(t)?9007199254740991:j1(t)?10:11:K(28295,{value:t})}function Dt(t,e){if(t===e)return!0;const n=An(t);if(n!==An(e))return!1;switch(n){case 0:case 9007199254740991:return!0;case 1:return t.booleanValue===e.booleanValue;case 4:return Gs(t).isEqual(Gs(e));case 3:return(function(s,i){if(typeof s.timestampValue=="string"&&typeof i.timestampValue=="string"&&s.timestampValue.length===i.timestampValue.length)return s.timestampValue===i.timestampValue;const o=In(s.timestampValue),c=In(i.timestampValue);return o.seconds===c.seconds&&o.nanos===c.nanos})(t,e);case 5:return t.stringValue===e.stringValue;case 6:return(function(s,i){return bn(s.bytesValue).isEqual(bn(i.bytesValue))})(t,e);case 7:return t.referenceValue===e.referenceValue;case 8:return(function(s,i){return Ie(s.geoPointValue.latitude)===Ie(i.geoPointValue.latitude)&&Ie(s.geoPointValue.longitude)===Ie(i.geoPointValue.longitude)})(t,e);case 2:return(function(s,i){if("integerValue"in s&&"integerValue"in i)return Ie(s.integerValue)===Ie(i.integerValue);if("doubleValue"in s&&"doubleValue"in i){const o=Ie(s.doubleValue),c=Ie(i.doubleValue);return o===c?ko(o)===ko(c):isNaN(o)&&isNaN(c)}return!1})(t,e);case 9:return Vr(t.arrayValue.values||[],e.arrayValue.values||[],Dt);case 10:case 11:return(function(s,i){const o=s.mapValue.fields||{},c=i.mapValue.fields||{};if(cp(o)!==cp(c))return!1;for(const l in o)if(o.hasOwnProperty(l)&&(c[l]===void 0||!Dt(o[l],c[l])))return!1;return!0})(t,e);default:return K(52216,{left:t})}}function Ys(t,e){return(t.values||[]).find((n=>Dt(n,e)))!==void 0}function Dr(t,e){if(t===e)return 0;const n=An(t),r=An(e);if(n!==r)return te(n,r);switch(n){case 0:case 9007199254740991:return 0;case 1:return te(t.booleanValue,e.booleanValue);case 2:return(function(i,o){const c=Ie(i.integerValue||i.doubleValue),l=Ie(o.integerValue||o.doubleValue);return c<l?-1:c>l?1:c===l?0:isNaN(c)?isNaN(l)?0:-1:1})(t,e);case 3:return up(t.timestampValue,e.timestampValue);case 4:return up(Gs(t),Gs(e));case 5:return al(t.stringValue,e.stringValue);case 6:return(function(i,o){const c=bn(i),l=bn(o);return c.compareTo(l)})(t.bytesValue,e.bytesValue);case 7:return(function(i,o){const c=i.split("/"),l=o.split("/");for(let u=0;u<c.length&&u<l.length;u++){const h=te(c[u],l[u]);if(h!==0)return h}return te(c.length,l.length)})(t.referenceValue,e.referenceValue);case 8:return(function(i,o){const c=te(Ie(i.latitude),Ie(o.latitude));return c!==0?c:te(Ie(i.longitude),Ie(o.longitude))})(t.geoPointValue,e.geoPointValue);case 9:return hp(t.arrayValue,e.arrayValue);case 10:return(function(i,o){var m,y,w,R;const c=i.fields||{},l=o.fields||{},u=(m=c[Vo])==null?void 0:m.arrayValue,h=(y=l[Vo])==null?void 0:y.arrayValue,f=te(((w=u==null?void 0:u.values)==null?void 0:w.length)||0,((R=h==null?void 0:h.values)==null?void 0:R.length)||0);return f!==0?f:hp(u,h)})(t.mapValue,e.mapValue);case 11:return(function(i,o){if(i===Hi.mapValue&&o===Hi.mapValue)return 0;if(i===Hi.mapValue)return 1;if(o===Hi.mapValue)return-1;const c=i.fields||{},l=Object.keys(c),u=o.fields||{},h=Object.keys(u);l.sort(),h.sort();for(let f=0;f<l.length&&f<h.length;++f){const m=al(l[f],h[f]);if(m!==0)return m;const y=Dr(c[l[f]],u[h[f]]);if(y!==0)return y}return te(l.length,h.length)})(t.mapValue,e.mapValue);default:throw K(23264,{he:n})}}function up(t,e){if(typeof t=="string"&&typeof e=="string"&&t.length===e.length)return te(t,e);const n=In(t),r=In(e),s=te(n.seconds,r.seconds);return s!==0?s:te(n.nanos,r.nanos)}function hp(t,e){const n=t.values||[],r=e.values||[];for(let s=0;s<n.length&&s<r.length;++s){const i=Dr(n[s],r[s]);if(i)return i}return te(n.length,r.length)}function Mr(t){return cl(t)}function cl(t){return"nullValue"in t?"null":"booleanValue"in t?""+t.booleanValue:"integerValue"in t?""+t.integerValue:"doubleValue"in t?""+t.doubleValue:"timestampValue"in t?(function(n){const r=In(n);return`time(${r.seconds},${r.nanos})`})(t.timestampValue):"stringValue"in t?t.stringValue:"bytesValue"in t?(function(n){return bn(n).toBase64()})(t.bytesValue):"referenceValue"in t?(function(n){return G.fromName(n).toString()})(t.referenceValue):"geoPointValue"in t?(function(n){return`geo(${n.latitude},${n.longitude})`})(t.geoPointValue):"arrayValue"in t?(function(n){let r="[",s=!0;for(const i of n.values||[])s?s=!1:r+=",",r+=cl(i);return r+"]"})(t.arrayValue):"mapValue"in t?(function(n){const r=Object.keys(n.fields||{}).sort();let s="{",i=!0;for(const o of r)i?i=!1:s+=",",s+=`${o}:${cl(n.fields[o])}`;return s+"}"})(t.mapValue):K(61005,{value:t})}function ao(t){switch(An(t)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=ca(t);return e?16+ao(e):16;case 5:return 2*t.stringValue.length;case 6:return bn(t.bytesValue).approximateByteSize();case 7:return t.referenceValue.length;case 9:return(function(r){return(r.values||[]).reduce(((s,i)=>s+ao(i)),0)})(t.arrayValue);case 10:case 11:return(function(r){let s=0;return xn(r.fields,((i,o)=>{s+=i.length+ao(o)})),s})(t.mapValue);default:throw K(13486,{value:t})}}function dp(t,e){return{referenceValue:`projects/${t.projectId}/databases/${t.database}/documents/${e.path.canonicalString()}`}}function ll(t){return!!t&&"integerValue"in t}function vu(t){return!!t&&"arrayValue"in t}function fp(t){return!!t&&"nullValue"in t}function pp(t){return!!t&&"doubleValue"in t&&isNaN(Number(t.doubleValue))}function co(t){return!!t&&"mapValue"in t}function j1(t){var n,r;return((r=(((n=t==null?void 0:t.mapValue)==null?void 0:n.fields)||{})[__])==null?void 0:r.stringValue)===v_}function Ns(t){if(t.geoPointValue)return{geoPointValue:{...t.geoPointValue}};if(t.timestampValue&&typeof t.timestampValue=="object")return{timestampValue:{...t.timestampValue}};if(t.mapValue){const e={mapValue:{fields:{}}};return xn(t.mapValue.fields,((n,r)=>e.mapValue.fields[n]=Ns(r))),e}if(t.arrayValue){const e={arrayValue:{values:[]}};for(let n=0;n<(t.arrayValue.values||[]).length;++n)e.arrayValue.values[n]=Ns(t.arrayValue.values[n]);return e}return{...t}}function $1(t){return(((t.mapValue||{}).fields||{}).__type__||{}).stringValue===B1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ze{constructor(e){this.value=e}static empty(){return new Ze({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let n=this.value;for(let r=0;r<e.length-1;++r)if(n=(n.mapValue.fields||{})[e.get(r)],!co(n))return null;return n=(n.mapValue.fields||{})[e.lastSegment()],n||null}}set(e,n){this.getFieldsMap(e.popLast())[e.lastSegment()]=Ns(n)}setAll(e){let n=Ue.emptyPath(),r={},s=[];e.forEach(((o,c)=>{if(!n.isImmediateParentOf(c)){const l=this.getFieldsMap(n);this.applyChanges(l,r,s),r={},s=[],n=c.popLast()}o?r[c.lastSegment()]=Ns(o):s.push(c.lastSegment())}));const i=this.getFieldsMap(n);this.applyChanges(i,r,s)}delete(e){const n=this.field(e.popLast());co(n)&&n.mapValue.fields&&delete n.mapValue.fields[e.lastSegment()]}isEqual(e){return Dt(this.value,e.value)}getFieldsMap(e){let n=this.value;n.mapValue.fields||(n.mapValue={fields:{}});for(let r=0;r<e.length;++r){let s=n.mapValue.fields[e.get(r)];co(s)&&s.mapValue.fields||(s={mapValue:{fields:{}}},n.mapValue.fields[e.get(r)]=s),n=s}return n.mapValue.fields}applyChanges(e,n,r){xn(n,((s,i)=>e[s]=i));for(const s of r)delete e[s]}clone(){return new Ze(Ns(this.value))}}function w_(t){const e=[];return xn(t.fields,((n,r)=>{const s=new Ue([n]);if(co(r)){const i=w_(r.mapValue).fields;if(i.length===0)e.push(s);else for(const o of i)e.push(s.child(o))}else e.push(s)})),new rt(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class We{constructor(e,n,r,s,i,o,c){this.key=e,this.documentType=n,this.version=r,this.readTime=s,this.createTime=i,this.data=o,this.documentState=c}static newInvalidDocument(e){return new We(e,0,Q.min(),Q.min(),Q.min(),Ze.empty(),0)}static newFoundDocument(e,n,r,s){return new We(e,1,n,Q.min(),r,s,0)}static newNoDocument(e,n){return new We(e,2,n,Q.min(),Q.min(),Ze.empty(),0)}static newUnknownDocument(e,n){return new We(e,3,n,Q.min(),Q.min(),Ze.empty(),2)}convertToFoundDocument(e,n){return!this.createTime.isEqual(Q.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=n,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=Ze.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=Ze.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=Q.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof We&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new We(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Do{constructor(e,n){this.position=e,this.inclusive=n}}function mp(t,e,n){let r=0;for(let s=0;s<t.position.length;s++){const i=e[s],o=t.position[s];if(i.field.isKeyField()?r=G.comparator(G.fromName(o.referenceValue),n.key):r=Dr(o,n.data.field(i.field)),i.dir==="desc"&&(r*=-1),r!==0)break}return r}function gp(t,e){if(t===null)return e===null;if(e===null||t.inclusive!==e.inclusive||t.position.length!==e.position.length)return!1;for(let n=0;n<t.position.length;n++)if(!Dt(t.position[n],e.position[n]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qs{constructor(e,n="asc"){this.field=e,this.dir=n}}function z1(t,e){return t.dir===e.dir&&t.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class T_{}class Re extends T_{constructor(e,n,r){super(),this.field=e,this.op=n,this.value=r}static create(e,n,r){return e.isKeyField()?n==="in"||n==="not-in"?this.createKeyFieldInFilter(e,n,r):new W1(e,n,r):n==="array-contains"?new K1(e,r):n==="in"?new Y1(e,r):n==="not-in"?new Q1(e,r):n==="array-contains-any"?new X1(e,r):new Re(e,n,r)}static createKeyFieldInFilter(e,n,r){return n==="in"?new H1(e,r):new G1(e,r)}matches(e){const n=e.data.field(this.field);return this.op==="!="?n!==null&&n.nullValue===void 0&&this.matchesComparison(Dr(n,this.value)):n!==null&&An(this.value)===An(n)&&this.matchesComparison(Dr(n,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return K(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class _t extends T_{constructor(e,n){super(),this.filters=e,this.op=n,this.Pe=null}static create(e,n){return new _t(e,n)}matches(e){return E_(this)?this.filters.find((n=>!n.matches(e)))===void 0:this.filters.find((n=>n.matches(e)))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce(((e,n)=>e.concat(n.getFlattenedFilters())),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function E_(t){return t.op==="and"}function I_(t){return q1(t)&&E_(t)}function q1(t){for(const e of t.filters)if(e instanceof _t)return!1;return!0}function ul(t){if(t instanceof Re)return t.field.canonicalString()+t.op.toString()+Mr(t.value);if(I_(t))return t.filters.map((e=>ul(e))).join(",");{const e=t.filters.map((n=>ul(n))).join(",");return`${t.op}(${e})`}}function b_(t,e){return t instanceof Re?(function(r,s){return s instanceof Re&&r.op===s.op&&r.field.isEqual(s.field)&&Dt(r.value,s.value)})(t,e):t instanceof _t?(function(r,s){return s instanceof _t&&r.op===s.op&&r.filters.length===s.filters.length?r.filters.reduce(((i,o,c)=>i&&b_(o,s.filters[c])),!0):!1})(t,e):void K(19439)}function A_(t){return t instanceof Re?(function(n){return`${n.field.canonicalString()} ${n.op} ${Mr(n.value)}`})(t):t instanceof _t?(function(n){return n.op.toString()+" {"+n.getFilters().map(A_).join(" ,")+"}"})(t):"Filter"}class W1 extends Re{constructor(e,n,r){super(e,n,r),this.key=G.fromName(r.referenceValue)}matches(e){const n=G.comparator(e.key,this.key);return this.matchesComparison(n)}}class H1 extends Re{constructor(e,n){super(e,"in",n),this.keys=R_("in",n)}matches(e){return this.keys.some((n=>n.isEqual(e.key)))}}class G1 extends Re{constructor(e,n){super(e,"not-in",n),this.keys=R_("not-in",n)}matches(e){return!this.keys.some((n=>n.isEqual(e.key)))}}function R_(t,e){var n;return(((n=e.arrayValue)==null?void 0:n.values)||[]).map((r=>G.fromName(r.referenceValue)))}class K1 extends Re{constructor(e,n){super(e,"array-contains",n)}matches(e){const n=e.data.field(this.field);return vu(n)&&Ys(n.arrayValue,this.value)}}class Y1 extends Re{constructor(e,n){super(e,"in",n)}matches(e){const n=e.data.field(this.field);return n!==null&&Ys(this.value.arrayValue,n)}}class Q1 extends Re{constructor(e,n){super(e,"not-in",n)}matches(e){if(Ys(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const n=e.data.field(this.field);return n!==null&&n.nullValue===void 0&&!Ys(this.value.arrayValue,n)}}class X1 extends Re{constructor(e,n){super(e,"array-contains-any",n)}matches(e){const n=e.data.field(this.field);return!(!vu(n)||!n.arrayValue.values)&&n.arrayValue.values.some((r=>Ys(this.value.arrayValue,r)))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class J1{constructor(e,n=null,r=[],s=[],i=null,o=null,c=null){this.path=e,this.collectionGroup=n,this.orderBy=r,this.filters=s,this.limit=i,this.startAt=o,this.endAt=c,this.Te=null}}function yp(t,e=null,n=[],r=[],s=null,i=null,o=null){return new J1(t,e,n,r,s,i,o)}function wu(t){const e=X(t);if(e.Te===null){let n=e.path.canonicalString();e.collectionGroup!==null&&(n+="|cg:"+e.collectionGroup),n+="|f:",n+=e.filters.map((r=>ul(r))).join(","),n+="|ob:",n+=e.orderBy.map((r=>(function(i){return i.field.canonicalString()+i.dir})(r))).join(","),aa(e.limit)||(n+="|l:",n+=e.limit),e.startAt&&(n+="|lb:",n+=e.startAt.inclusive?"b:":"a:",n+=e.startAt.position.map((r=>Mr(r))).join(",")),e.endAt&&(n+="|ub:",n+=e.endAt.inclusive?"a:":"b:",n+=e.endAt.position.map((r=>Mr(r))).join(",")),e.Te=n}return e.Te}function Tu(t,e){if(t.limit!==e.limit||t.orderBy.length!==e.orderBy.length)return!1;for(let n=0;n<t.orderBy.length;n++)if(!z1(t.orderBy[n],e.orderBy[n]))return!1;if(t.filters.length!==e.filters.length)return!1;for(let n=0;n<t.filters.length;n++)if(!b_(t.filters[n],e.filters[n]))return!1;return t.collectionGroup===e.collectionGroup&&!!t.path.isEqual(e.path)&&!!gp(t.startAt,e.startAt)&&gp(t.endAt,e.endAt)}function hl(t){return G.isDocumentKey(t.path)&&t.collectionGroup===null&&t.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yr{constructor(e,n=null,r=[],s=[],i=null,o="F",c=null,l=null){this.path=e,this.collectionGroup=n,this.explicitOrderBy=r,this.filters=s,this.limit=i,this.limitType=o,this.startAt=c,this.endAt=l,this.Ee=null,this.Ie=null,this.Re=null,this.startAt,this.endAt}}function Z1(t,e,n,r,s,i,o,c){return new Yr(t,e,n,r,s,i,o,c)}function la(t){return new Yr(t)}function _p(t){return t.filters.length===0&&t.limit===null&&t.startAt==null&&t.endAt==null&&(t.explicitOrderBy.length===0||t.explicitOrderBy.length===1&&t.explicitOrderBy[0].field.isKeyField())}function ek(t){return G.isDocumentKey(t.path)&&t.collectionGroup===null&&t.filters.length===0}function S_(t){return t.collectionGroup!==null}function Ls(t){const e=X(t);if(e.Ee===null){e.Ee=[];const n=new Set;for(const i of e.explicitOrderBy)e.Ee.push(i),n.add(i.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let c=new De(Ue.comparator);return o.filters.forEach((l=>{l.getFlattenedFilters().forEach((u=>{u.isInequality()&&(c=c.add(u.field))}))})),c})(e).forEach((i=>{n.has(i.canonicalString())||i.isKeyField()||e.Ee.push(new Qs(i,r))})),n.has(Ue.keyField().canonicalString())||e.Ee.push(new Qs(Ue.keyField(),r))}return e.Ee}function Pt(t){const e=X(t);return e.Ie||(e.Ie=tk(e,Ls(t))),e.Ie}function tk(t,e){if(t.limitType==="F")return yp(t.path,t.collectionGroup,e,t.filters,t.limit,t.startAt,t.endAt);{e=e.map((s=>{const i=s.dir==="desc"?"asc":"desc";return new Qs(s.field,i)}));const n=t.endAt?new Do(t.endAt.position,t.endAt.inclusive):null,r=t.startAt?new Do(t.startAt.position,t.startAt.inclusive):null;return yp(t.path,t.collectionGroup,e,t.filters,t.limit,n,r)}}function dl(t,e){const n=t.filters.concat([e]);return new Yr(t.path,t.collectionGroup,t.explicitOrderBy.slice(),n,t.limit,t.limitType,t.startAt,t.endAt)}function nk(t,e){const n=t.explicitOrderBy.concat([e]);return new Yr(t.path,t.collectionGroup,n,t.filters.slice(),t.limit,t.limitType,t.startAt,t.endAt)}function fl(t,e,n){return new Yr(t.path,t.collectionGroup,t.explicitOrderBy.slice(),t.filters.slice(),e,n,t.startAt,t.endAt)}function ua(t,e){return Tu(Pt(t),Pt(e))&&t.limitType===e.limitType}function P_(t){return`${wu(Pt(t))}|lt:${t.limitType}`}function wr(t){return`Query(target=${(function(n){let r=n.path.canonicalString();return n.collectionGroup!==null&&(r+=" collectionGroup="+n.collectionGroup),n.filters.length>0&&(r+=`, filters: [${n.filters.map((s=>A_(s))).join(", ")}]`),aa(n.limit)||(r+=", limit: "+n.limit),n.orderBy.length>0&&(r+=`, orderBy: [${n.orderBy.map((s=>(function(o){return`${o.field.canonicalString()} (${o.dir})`})(s))).join(", ")}]`),n.startAt&&(r+=", startAt: ",r+=n.startAt.inclusive?"b:":"a:",r+=n.startAt.position.map((s=>Mr(s))).join(",")),n.endAt&&(r+=", endAt: ",r+=n.endAt.inclusive?"a:":"b:",r+=n.endAt.position.map((s=>Mr(s))).join(",")),`Target(${r})`})(Pt(t))}; limitType=${t.limitType})`}function ha(t,e){return e.isFoundDocument()&&(function(r,s){const i=s.key.path;return r.collectionGroup!==null?s.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(i):G.isDocumentKey(r.path)?r.path.isEqual(i):r.path.isImmediateParentOf(i)})(t,e)&&(function(r,s){for(const i of Ls(r))if(!i.field.isKeyField()&&s.data.field(i.field)===null)return!1;return!0})(t,e)&&(function(r,s){for(const i of r.filters)if(!i.matches(s))return!1;return!0})(t,e)&&(function(r,s){return!(r.startAt&&!(function(o,c,l){const u=mp(o,c,l);return o.inclusive?u<=0:u<0})(r.startAt,Ls(r),s)||r.endAt&&!(function(o,c,l){const u=mp(o,c,l);return o.inclusive?u>=0:u>0})(r.endAt,Ls(r),s))})(t,e)}function rk(t){return t.collectionGroup||(t.path.length%2==1?t.path.lastSegment():t.path.get(t.path.length-2))}function C_(t){return(e,n)=>{let r=!1;for(const s of Ls(t)){const i=sk(s,e,n);if(i!==0)return i;r=r||s.field.isKeyField()}return 0}}function sk(t,e,n){const r=t.field.isKeyField()?G.comparator(e.key,n.key):(function(i,o,c){const l=o.data.field(i),u=c.data.field(i);return l!==null&&u!==null?Dr(l,u):K(42886)})(t.field,e,n);switch(t.dir){case"asc":return r;case"desc":return-1*r;default:return K(19790,{direction:t.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hr{constructor(e,n){this.mapKeyFn=e,this.equalsFn=n,this.inner={},this.innerSize=0}get(e){const n=this.mapKeyFn(e),r=this.inner[n];if(r!==void 0){for(const[s,i]of r)if(this.equalsFn(s,e))return i}}has(e){return this.get(e)!==void 0}set(e,n){const r=this.mapKeyFn(e),s=this.inner[r];if(s===void 0)return this.inner[r]=[[e,n]],void this.innerSize++;for(let i=0;i<s.length;i++)if(this.equalsFn(s[i][0],e))return void(s[i]=[e,n]);s.push([e,n]),this.innerSize++}delete(e){const n=this.mapKeyFn(e),r=this.inner[n];if(r===void 0)return!1;for(let s=0;s<r.length;s++)if(this.equalsFn(r[s][0],e))return r.length===1?delete this.inner[n]:r.splice(s,1),this.innerSize--,!0;return!1}forEach(e){xn(this.inner,((n,r)=>{for(const[s,i]of r)e(s,i)}))}isEmpty(){return d_(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ik=new _e(G.comparator);function Gt(){return ik}const k_=new _e(G.comparator);function As(...t){let e=k_;for(const n of t)e=e.insert(n.key,n);return e}function x_(t){let e=k_;return t.forEach(((n,r)=>e=e.insert(n,r.overlayedDocument))),e}function Yn(){return Os()}function V_(){return Os()}function Os(){return new hr((t=>t.toString()),((t,e)=>t.isEqual(e)))}const ok=new _e(G.comparator),ak=new De(G.comparator);function ne(...t){let e=ak;for(const n of t)e=e.add(n);return e}const ck=new De(te);function lk(){return ck}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Eu(t,e){if(t.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:ko(e)?"-0":e}}function D_(t){return{integerValue:""+t}}function M_(t,e){return M1(e)?D_(e):Eu(t,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class da{constructor(){this._=void 0}}function uk(t,e,n){return t instanceof Xs?(function(s,i){const o={fields:{[m_]:{stringValue:p_},[y_]:{timestampValue:{seconds:s.seconds,nanos:s.nanoseconds}}}};return i&&_u(i)&&(i=ca(i)),i&&(o.fields[g_]=i),{mapValue:o}})(n,e):t instanceof Js?L_(t,e):t instanceof Zs?O_(t,e):(function(s,i){const o=N_(s,i),c=vp(o)+vp(s.Ae);return ll(o)&&ll(s.Ae)?D_(c):Eu(s.serializer,c)})(t,e)}function hk(t,e,n){return t instanceof Js?L_(t,e):t instanceof Zs?O_(t,e):n}function N_(t,e){return t instanceof ei?(function(r){return ll(r)||(function(i){return!!i&&"doubleValue"in i})(r)})(e)?e:{integerValue:0}:null}class Xs extends da{}class Js extends da{constructor(e){super(),this.elements=e}}function L_(t,e){const n=F_(e);for(const r of t.elements)n.some((s=>Dt(s,r)))||n.push(r);return{arrayValue:{values:n}}}class Zs extends da{constructor(e){super(),this.elements=e}}function O_(t,e){let n=F_(e);for(const r of t.elements)n=n.filter((s=>!Dt(s,r)));return{arrayValue:{values:n}}}class ei extends da{constructor(e,n){super(),this.serializer=e,this.Ae=n}}function vp(t){return Ie(t.integerValue||t.doubleValue)}function F_(t){return vu(t)&&t.arrayValue.values?t.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class U_{constructor(e,n){this.field=e,this.transform=n}}function dk(t,e){return t.field.isEqual(e.field)&&(function(r,s){return r instanceof Js&&s instanceof Js||r instanceof Zs&&s instanceof Zs?Vr(r.elements,s.elements,Dt):r instanceof ei&&s instanceof ei?Dt(r.Ae,s.Ae):r instanceof Xs&&s instanceof Xs})(t.transform,e.transform)}class fk{constructor(e,n){this.version=e,this.transformResults=n}}class Xe{constructor(e,n){this.updateTime=e,this.exists=n}static none(){return new Xe}static exists(e){return new Xe(void 0,e)}static updateTime(e){return new Xe(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function lo(t,e){return t.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(t.updateTime):t.exists===void 0||t.exists===e.isFoundDocument()}class fa{}function B_(t,e){if(!t.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return t.isNoDocument()?new pa(t.key,Xe.none()):new hi(t.key,t.data,Xe.none());{const n=t.data,r=Ze.empty();let s=new De(Ue.comparator);for(let i of e.fields)if(!s.has(i)){let o=n.field(i);o===null&&i.length>1&&(i=i.popLast(),o=n.field(i)),o===null?r.delete(i):r.set(i,o),s=s.add(i)}return new Vn(t.key,r,new rt(s.toArray()),Xe.none())}}function pk(t,e,n){t instanceof hi?(function(s,i,o){const c=s.value.clone(),l=Tp(s.fieldTransforms,i,o.transformResults);c.setAll(l),i.convertToFoundDocument(o.version,c).setHasCommittedMutations()})(t,e,n):t instanceof Vn?(function(s,i,o){if(!lo(s.precondition,i))return void i.convertToUnknownDocument(o.version);const c=Tp(s.fieldTransforms,i,o.transformResults),l=i.data;l.setAll(j_(s)),l.setAll(c),i.convertToFoundDocument(o.version,l).setHasCommittedMutations()})(t,e,n):(function(s,i,o){i.convertToNoDocument(o.version).setHasCommittedMutations()})(0,e,n)}function Fs(t,e,n,r){return t instanceof hi?(function(i,o,c,l){if(!lo(i.precondition,o))return c;const u=i.value.clone(),h=Ep(i.fieldTransforms,l,o);return u.setAll(h),o.convertToFoundDocument(o.version,u).setHasLocalMutations(),null})(t,e,n,r):t instanceof Vn?(function(i,o,c,l){if(!lo(i.precondition,o))return c;const u=Ep(i.fieldTransforms,l,o),h=o.data;return h.setAll(j_(i)),h.setAll(u),o.convertToFoundDocument(o.version,h).setHasLocalMutations(),c===null?null:c.unionWith(i.fieldMask.fields).unionWith(i.fieldTransforms.map((f=>f.field)))})(t,e,n,r):(function(i,o,c){return lo(i.precondition,o)?(o.convertToNoDocument(o.version).setHasLocalMutations(),null):c})(t,e,n)}function mk(t,e){let n=null;for(const r of t.fieldTransforms){const s=e.data.field(r.field),i=N_(r.transform,s||null);i!=null&&(n===null&&(n=Ze.empty()),n.set(r.field,i))}return n||null}function wp(t,e){return t.type===e.type&&!!t.key.isEqual(e.key)&&!!t.precondition.isEqual(e.precondition)&&!!(function(r,s){return r===void 0&&s===void 0||!(!r||!s)&&Vr(r,s,((i,o)=>dk(i,o)))})(t.fieldTransforms,e.fieldTransforms)&&(t.type===0?t.value.isEqual(e.value):t.type!==1||t.data.isEqual(e.data)&&t.fieldMask.isEqual(e.fieldMask))}class hi extends fa{constructor(e,n,r,s=[]){super(),this.key=e,this.value=n,this.precondition=r,this.fieldTransforms=s,this.type=0}getFieldMask(){return null}}class Vn extends fa{constructor(e,n,r,s,i=[]){super(),this.key=e,this.data=n,this.fieldMask=r,this.precondition=s,this.fieldTransforms=i,this.type=1}getFieldMask(){return this.fieldMask}}function j_(t){const e=new Map;return t.fieldMask.fields.forEach((n=>{if(!n.isEmpty()){const r=t.data.field(n);e.set(n,r)}})),e}function Tp(t,e,n){const r=new Map;oe(t.length===n.length,32656,{Ve:n.length,de:t.length});for(let s=0;s<n.length;s++){const i=t[s],o=i.transform,c=e.data.field(i.field);r.set(i.field,hk(o,c,n[s]))}return r}function Ep(t,e,n){const r=new Map;for(const s of t){const i=s.transform,o=n.data.field(s.field);r.set(s.field,uk(i,o,e))}return r}class pa extends fa{constructor(e,n){super(),this.key=e,this.precondition=n,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class gk extends fa{constructor(e,n){super(),this.key=e,this.precondition=n,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yk{constructor(e,n,r,s){this.batchId=e,this.localWriteTime=n,this.baseMutations=r,this.mutations=s}applyToRemoteDocument(e,n){const r=n.mutationResults;for(let s=0;s<this.mutations.length;s++){const i=this.mutations[s];i.key.isEqual(e.key)&&pk(i,e,r[s])}}applyToLocalView(e,n){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(n=Fs(r,e,n,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(n=Fs(r,e,n,this.localWriteTime));return n}applyToLocalDocumentSet(e,n){const r=V_();return this.mutations.forEach((s=>{const i=e.get(s.key),o=i.overlayedDocument;let c=this.applyToLocalView(o,i.mutatedFields);c=n.has(s.key)?null:c;const l=B_(o,c);l!==null&&r.set(s.key,l),o.isValidDocument()||o.convertToNoDocument(Q.min())})),r}keys(){return this.mutations.reduce(((e,n)=>e.add(n.key)),ne())}isEqual(e){return this.batchId===e.batchId&&Vr(this.mutations,e.mutations,((n,r)=>wp(n,r)))&&Vr(this.baseMutations,e.baseMutations,((n,r)=>wp(n,r)))}}class Iu{constructor(e,n,r,s){this.batch=e,this.commitVersion=n,this.mutationResults=r,this.docVersions=s}static from(e,n,r){oe(e.mutations.length===r.length,58842,{me:e.mutations.length,fe:r.length});let s=(function(){return ok})();const i=e.mutations;for(let o=0;o<i.length;o++)s=s.insert(i[o].key,r[o].version);return new Iu(e,n,r,s)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _k{constructor(e,n){this.largestBatchId=e,this.mutation=n}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vk{constructor(e,n){this.count=e,this.unchangedNames=n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var be,re;function wk(t){switch(t){case M.OK:return K(64938);case M.CANCELLED:case M.UNKNOWN:case M.DEADLINE_EXCEEDED:case M.RESOURCE_EXHAUSTED:case M.INTERNAL:case M.UNAVAILABLE:case M.UNAUTHENTICATED:return!1;case M.INVALID_ARGUMENT:case M.NOT_FOUND:case M.ALREADY_EXISTS:case M.PERMISSION_DENIED:case M.FAILED_PRECONDITION:case M.ABORTED:case M.OUT_OF_RANGE:case M.UNIMPLEMENTED:case M.DATA_LOSS:return!0;default:return K(15467,{code:t})}}function $_(t){if(t===void 0)return Ht("GRPC error has no .code"),M.UNKNOWN;switch(t){case be.OK:return M.OK;case be.CANCELLED:return M.CANCELLED;case be.UNKNOWN:return M.UNKNOWN;case be.DEADLINE_EXCEEDED:return M.DEADLINE_EXCEEDED;case be.RESOURCE_EXHAUSTED:return M.RESOURCE_EXHAUSTED;case be.INTERNAL:return M.INTERNAL;case be.UNAVAILABLE:return M.UNAVAILABLE;case be.UNAUTHENTICATED:return M.UNAUTHENTICATED;case be.INVALID_ARGUMENT:return M.INVALID_ARGUMENT;case be.NOT_FOUND:return M.NOT_FOUND;case be.ALREADY_EXISTS:return M.ALREADY_EXISTS;case be.PERMISSION_DENIED:return M.PERMISSION_DENIED;case be.FAILED_PRECONDITION:return M.FAILED_PRECONDITION;case be.ABORTED:return M.ABORTED;case be.OUT_OF_RANGE:return M.OUT_OF_RANGE;case be.UNIMPLEMENTED:return M.UNIMPLEMENTED;case be.DATA_LOSS:return M.DATA_LOSS;default:return K(39323,{code:t})}}(re=be||(be={}))[re.OK=0]="OK",re[re.CANCELLED=1]="CANCELLED",re[re.UNKNOWN=2]="UNKNOWN",re[re.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",re[re.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",re[re.NOT_FOUND=5]="NOT_FOUND",re[re.ALREADY_EXISTS=6]="ALREADY_EXISTS",re[re.PERMISSION_DENIED=7]="PERMISSION_DENIED",re[re.UNAUTHENTICATED=16]="UNAUTHENTICATED",re[re.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",re[re.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",re[re.ABORTED=10]="ABORTED",re[re.OUT_OF_RANGE=11]="OUT_OF_RANGE",re[re.UNIMPLEMENTED=12]="UNIMPLEMENTED",re[re.INTERNAL=13]="INTERNAL",re[re.UNAVAILABLE=14]="UNAVAILABLE",re[re.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Tk(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ek=new yn([4294967295,4294967295],0);function Ip(t){const e=Tk().encode(t),n=new t_;return n.update(e),new Uint8Array(n.digest())}function bp(t){const e=new DataView(t.buffer),n=e.getUint32(0,!0),r=e.getUint32(4,!0),s=e.getUint32(8,!0),i=e.getUint32(12,!0);return[new yn([n,r],0),new yn([s,i],0)]}class bu{constructor(e,n,r){if(this.bitmap=e,this.padding=n,this.hashCount=r,n<0||n>=8)throw new Rs(`Invalid padding: ${n}`);if(r<0)throw new Rs(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new Rs(`Invalid hash count: ${r}`);if(e.length===0&&n!==0)throw new Rs(`Invalid padding when bitmap length is 0: ${n}`);this.ge=8*e.length-n,this.pe=yn.fromNumber(this.ge)}ye(e,n,r){let s=e.add(n.multiply(yn.fromNumber(r)));return s.compare(Ek)===1&&(s=new yn([s.getBits(0),s.getBits(1)],0)),s.modulo(this.pe).toNumber()}we(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.ge===0)return!1;const n=Ip(e),[r,s]=bp(n);for(let i=0;i<this.hashCount;i++){const o=this.ye(r,s,i);if(!this.we(o))return!1}return!0}static create(e,n,r){const s=e%8==0?0:8-e%8,i=new Uint8Array(Math.ceil(e/8)),o=new bu(i,s,n);return r.forEach((c=>o.insert(c))),o}insert(e){if(this.ge===0)return;const n=Ip(e),[r,s]=bp(n);for(let i=0;i<this.hashCount;i++){const o=this.ye(r,s,i);this.Se(o)}}Se(e){const n=Math.floor(e/8),r=e%8;this.bitmap[n]|=1<<r}}class Rs extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ma{constructor(e,n,r,s,i){this.snapshotVersion=e,this.targetChanges=n,this.targetMismatches=r,this.documentUpdates=s,this.resolvedLimboDocuments=i}static createSynthesizedRemoteEventForCurrentChange(e,n,r){const s=new Map;return s.set(e,di.createSynthesizedTargetChangeForCurrentChange(e,n,r)),new ma(Q.min(),s,new _e(te),Gt(),ne())}}class di{constructor(e,n,r,s,i){this.resumeToken=e,this.current=n,this.addedDocuments=r,this.modifiedDocuments=s,this.removedDocuments=i}static createSynthesizedTargetChangeForCurrentChange(e,n,r){return new di(r,n,ne(),ne(),ne())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uo{constructor(e,n,r,s){this.be=e,this.removedTargetIds=n,this.key=r,this.De=s}}class z_{constructor(e,n){this.targetId=e,this.Ce=n}}class q_{constructor(e,n,r=je.EMPTY_BYTE_STRING,s=null){this.state=e,this.targetIds=n,this.resumeToken=r,this.cause=s}}class Ap{constructor(){this.ve=0,this.Fe=Rp(),this.Me=je.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(e){e.approximateByteSize()>0&&(this.Oe=!0,this.Me=e)}ke(){let e=ne(),n=ne(),r=ne();return this.Fe.forEach(((s,i)=>{switch(i){case 0:e=e.add(s);break;case 2:n=n.add(s);break;case 1:r=r.add(s);break;default:K(38017,{changeType:i})}})),new di(this.Me,this.xe,e,n,r)}qe(){this.Oe=!1,this.Fe=Rp()}Ke(e,n){this.Oe=!0,this.Fe=this.Fe.insert(e,n)}Ue(e){this.Oe=!0,this.Fe=this.Fe.remove(e)}$e(){this.ve+=1}We(){this.ve-=1,oe(this.ve>=0,3241,{ve:this.ve})}Qe(){this.Oe=!0,this.xe=!0}}class Ik{constructor(e){this.Ge=e,this.ze=new Map,this.je=Gt(),this.Je=Gi(),this.He=Gi(),this.Ze=new _e(te)}Xe(e){for(const n of e.be)e.De&&e.De.isFoundDocument()?this.Ye(n,e.De):this.et(n,e.key,e.De);for(const n of e.removedTargetIds)this.et(n,e.key,e.De)}tt(e){this.forEachTarget(e,(n=>{const r=this.nt(n);switch(e.state){case 0:this.rt(n)&&r.Le(e.resumeToken);break;case 1:r.We(),r.Ne||r.qe(),r.Le(e.resumeToken);break;case 2:r.We(),r.Ne||this.removeTarget(n);break;case 3:this.rt(n)&&(r.Qe(),r.Le(e.resumeToken));break;case 4:this.rt(n)&&(this.it(n),r.Le(e.resumeToken));break;default:K(56790,{state:e.state})}}))}forEachTarget(e,n){e.targetIds.length>0?e.targetIds.forEach(n):this.ze.forEach(((r,s)=>{this.rt(s)&&n(s)}))}st(e){const n=e.targetId,r=e.Ce.count,s=this.ot(n);if(s){const i=s.target;if(hl(i))if(r===0){const o=new G(i.path);this.et(n,o,We.newNoDocument(o,Q.min()))}else oe(r===1,20013,{expectedCount:r});else{const o=this._t(n);if(o!==r){const c=this.ut(e),l=c?this.ct(c,e,o):1;if(l!==0){this.it(n);const u=l===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ze=this.Ze.insert(n,u)}}}}}ut(e){const n=e.Ce.unchangedNames;if(!n||!n.bits)return null;const{bits:{bitmap:r="",padding:s=0},hashCount:i=0}=n;let o,c;try{o=bn(r).toUint8Array()}catch(l){if(l instanceof f_)return ir("Decoding the base64 bloom filter in existence filter failed ("+l.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw l}try{c=new bu(o,s,i)}catch(l){return ir(l instanceof Rs?"BloomFilter error: ":"Applying bloom filter failed: ",l),null}return c.ge===0?null:c}ct(e,n,r){return n.Ce.count===r-this.Pt(e,n.targetId)?0:2}Pt(e,n){const r=this.Ge.getRemoteKeysForTarget(n);let s=0;return r.forEach((i=>{const o=this.Ge.ht(),c=`projects/${o.projectId}/databases/${o.database}/documents/${i.path.canonicalString()}`;e.mightContain(c)||(this.et(n,i,null),s++)})),s}Tt(e){const n=new Map;this.ze.forEach(((i,o)=>{const c=this.ot(o);if(c){if(i.current&&hl(c.target)){const l=new G(c.target.path);this.Et(l).has(o)||this.It(o,l)||this.et(o,l,We.newNoDocument(l,e))}i.Be&&(n.set(o,i.ke()),i.qe())}}));let r=ne();this.He.forEach(((i,o)=>{let c=!0;o.forEachWhile((l=>{const u=this.ot(l);return!u||u.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)})),c&&(r=r.add(i))})),this.je.forEach(((i,o)=>o.setReadTime(e)));const s=new ma(e,n,this.Ze,this.je,r);return this.je=Gt(),this.Je=Gi(),this.He=Gi(),this.Ze=new _e(te),s}Ye(e,n){if(!this.rt(e))return;const r=this.It(e,n.key)?2:0;this.nt(e).Ke(n.key,r),this.je=this.je.insert(n.key,n),this.Je=this.Je.insert(n.key,this.Et(n.key).add(e)),this.He=this.He.insert(n.key,this.Rt(n.key).add(e))}et(e,n,r){if(!this.rt(e))return;const s=this.nt(e);this.It(e,n)?s.Ke(n,1):s.Ue(n),this.He=this.He.insert(n,this.Rt(n).delete(e)),this.He=this.He.insert(n,this.Rt(n).add(e)),r&&(this.je=this.je.insert(n,r))}removeTarget(e){this.ze.delete(e)}_t(e){const n=this.nt(e).ke();return this.Ge.getRemoteKeysForTarget(e).size+n.addedDocuments.size-n.removedDocuments.size}$e(e){this.nt(e).$e()}nt(e){let n=this.ze.get(e);return n||(n=new Ap,this.ze.set(e,n)),n}Rt(e){let n=this.He.get(e);return n||(n=new De(te),this.He=this.He.insert(e,n)),n}Et(e){let n=this.Je.get(e);return n||(n=new De(te),this.Je=this.Je.insert(e,n)),n}rt(e){const n=this.ot(e)!==null;return n||B("WatchChangeAggregator","Detected inactive target",e),n}ot(e){const n=this.ze.get(e);return n&&n.Ne?null:this.Ge.At(e)}it(e){this.ze.set(e,new Ap),this.Ge.getRemoteKeysForTarget(e).forEach((n=>{this.et(e,n,null)}))}It(e,n){return this.Ge.getRemoteKeysForTarget(e).has(n)}}function Gi(){return new _e(G.comparator)}function Rp(){return new _e(G.comparator)}const bk={asc:"ASCENDING",desc:"DESCENDING"},Ak={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},Rk={and:"AND",or:"OR"};class Sk{constructor(e,n){this.databaseId=e,this.useProto3Json=n}}function pl(t,e){return t.useProto3Json||aa(e)?e:{value:e}}function Mo(t,e){return t.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function W_(t,e){return t.useProto3Json?e.toBase64():e.toUint8Array()}function Pk(t,e){return Mo(t,e.toTimestamp())}function Ct(t){return oe(!!t,49232),Q.fromTimestamp((function(n){const r=In(n);return new fe(r.seconds,r.nanos)})(t))}function Au(t,e){return ml(t,e).canonicalString()}function ml(t,e){const n=(function(s){return new ue(["projects",s.projectId,"databases",s.database])})(t).child("documents");return e===void 0?n:n.child(e)}function H_(t){const e=ue.fromString(t);return oe(X_(e),10190,{key:e.toString()}),e}function gl(t,e){return Au(t.databaseId,e.path)}function wc(t,e){const n=H_(e);if(n.get(1)!==t.databaseId.projectId)throw new U(M.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+n.get(1)+" vs "+t.databaseId.projectId);if(n.get(3)!==t.databaseId.database)throw new U(M.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+n.get(3)+" vs "+t.databaseId.database);return new G(K_(n))}function G_(t,e){return Au(t.databaseId,e)}function Ck(t){const e=H_(t);return e.length===4?ue.emptyPath():K_(e)}function yl(t){return new ue(["projects",t.databaseId.projectId,"databases",t.databaseId.database]).canonicalString()}function K_(t){return oe(t.length>4&&t.get(4)==="documents",29091,{key:t.toString()}),t.popFirst(5)}function Sp(t,e,n){return{name:gl(t,e),fields:n.value.mapValue.fields}}function kk(t,e){let n;if("targetChange"in e){e.targetChange;const r=(function(u){return u==="NO_CHANGE"?0:u==="ADD"?1:u==="REMOVE"?2:u==="CURRENT"?3:u==="RESET"?4:K(39313,{state:u})})(e.targetChange.targetChangeType||"NO_CHANGE"),s=e.targetChange.targetIds||[],i=(function(u,h){return u.useProto3Json?(oe(h===void 0||typeof h=="string",58123),je.fromBase64String(h||"")):(oe(h===void 0||h instanceof Buffer||h instanceof Uint8Array,16193),je.fromUint8Array(h||new Uint8Array))})(t,e.targetChange.resumeToken),o=e.targetChange.cause,c=o&&(function(u){const h=u.code===void 0?M.UNKNOWN:$_(u.code);return new U(h,u.message||"")})(o);n=new q_(r,s,i,c||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const s=wc(t,r.document.name),i=Ct(r.document.updateTime),o=r.document.createTime?Ct(r.document.createTime):Q.min(),c=new Ze({mapValue:{fields:r.document.fields}}),l=We.newFoundDocument(s,i,o,c),u=r.targetIds||[],h=r.removedTargetIds||[];n=new uo(u,h,l.key,l)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const s=wc(t,r.document),i=r.readTime?Ct(r.readTime):Q.min(),o=We.newNoDocument(s,i),c=r.removedTargetIds||[];n=new uo([],c,o.key,o)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const s=wc(t,r.document),i=r.removedTargetIds||[];n=new uo([],i,s,null)}else{if(!("filter"in e))return K(11601,{Vt:e});{e.filter;const r=e.filter;r.targetId;const{count:s=0,unchangedNames:i}=r,o=new vk(s,i),c=r.targetId;n=new z_(c,o)}}return n}function xk(t,e){let n;if(e instanceof hi)n={update:Sp(t,e.key,e.value)};else if(e instanceof pa)n={delete:gl(t,e.key)};else if(e instanceof Vn)n={update:Sp(t,e.key,e.data),updateMask:Bk(e.fieldMask)};else{if(!(e instanceof gk))return K(16599,{dt:e.type});n={verify:gl(t,e.key)}}return e.fieldTransforms.length>0&&(n.updateTransforms=e.fieldTransforms.map((r=>(function(i,o){const c=o.transform;if(c instanceof Xs)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof Js)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof Zs)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof ei)return{fieldPath:o.field.canonicalString(),increment:c.Ae};throw K(20930,{transform:o.transform})})(0,r)))),e.precondition.isNone||(n.currentDocument=(function(s,i){return i.updateTime!==void 0?{updateTime:Pk(s,i.updateTime)}:i.exists!==void 0?{exists:i.exists}:K(27497)})(t,e.precondition)),n}function Vk(t,e){return t&&t.length>0?(oe(e!==void 0,14353),t.map((n=>(function(s,i){let o=s.updateTime?Ct(s.updateTime):Ct(i);return o.isEqual(Q.min())&&(o=Ct(i)),new fk(o,s.transformResults||[])})(n,e)))):[]}function Dk(t,e){return{documents:[G_(t,e.path)]}}function Mk(t,e){const n={structuredQuery:{}},r=e.path;let s;e.collectionGroup!==null?(s=r,n.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(s=r.popLast(),n.structuredQuery.from=[{collectionId:r.lastSegment()}]),n.parent=G_(t,s);const i=(function(u){if(u.length!==0)return Q_(_t.create(u,"and"))})(e.filters);i&&(n.structuredQuery.where=i);const o=(function(u){if(u.length!==0)return u.map((h=>(function(m){return{field:Tr(m.field),direction:Ok(m.dir)}})(h)))})(e.orderBy);o&&(n.structuredQuery.orderBy=o);const c=pl(t,e.limit);return c!==null&&(n.structuredQuery.limit=c),e.startAt&&(n.structuredQuery.startAt=(function(u){return{before:u.inclusive,values:u.position}})(e.startAt)),e.endAt&&(n.structuredQuery.endAt=(function(u){return{before:!u.inclusive,values:u.position}})(e.endAt)),{ft:n,parent:s}}function Nk(t){let e=Ck(t.parent);const n=t.structuredQuery,r=n.from?n.from.length:0;let s=null;if(r>0){oe(r===1,65062);const h=n.from[0];h.allDescendants?s=h.collectionId:e=e.child(h.collectionId)}let i=[];n.where&&(i=(function(f){const m=Y_(f);return m instanceof _t&&I_(m)?m.getFilters():[m]})(n.where));let o=[];n.orderBy&&(o=(function(f){return f.map((m=>(function(w){return new Qs(Er(w.field),(function(I){switch(I){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(w.direction))})(m)))})(n.orderBy));let c=null;n.limit&&(c=(function(f){let m;return m=typeof f=="object"?f.value:f,aa(m)?null:m})(n.limit));let l=null;n.startAt&&(l=(function(f){const m=!!f.before,y=f.values||[];return new Do(y,m)})(n.startAt));let u=null;return n.endAt&&(u=(function(f){const m=!f.before,y=f.values||[];return new Do(y,m)})(n.endAt)),Z1(e,s,o,i,c,"F",l,u)}function Lk(t,e){const n=(function(s){switch(s){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return K(28987,{purpose:s})}})(e.purpose);return n==null?null:{"goog-listen-tags":n}}function Y_(t){return t.unaryFilter!==void 0?(function(n){switch(n.unaryFilter.op){case"IS_NAN":const r=Er(n.unaryFilter.field);return Re.create(r,"==",{doubleValue:NaN});case"IS_NULL":const s=Er(n.unaryFilter.field);return Re.create(s,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const i=Er(n.unaryFilter.field);return Re.create(i,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const o=Er(n.unaryFilter.field);return Re.create(o,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return K(61313);default:return K(60726)}})(t):t.fieldFilter!==void 0?(function(n){return Re.create(Er(n.fieldFilter.field),(function(s){switch(s){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return K(58110);default:return K(50506)}})(n.fieldFilter.op),n.fieldFilter.value)})(t):t.compositeFilter!==void 0?(function(n){return _t.create(n.compositeFilter.filters.map((r=>Y_(r))),(function(s){switch(s){case"AND":return"and";case"OR":return"or";default:return K(1026)}})(n.compositeFilter.op))})(t):K(30097,{filter:t})}function Ok(t){return bk[t]}function Fk(t){return Ak[t]}function Uk(t){return Rk[t]}function Tr(t){return{fieldPath:t.canonicalString()}}function Er(t){return Ue.fromServerFormat(t.fieldPath)}function Q_(t){return t instanceof Re?(function(n){if(n.op==="=="){if(pp(n.value))return{unaryFilter:{field:Tr(n.field),op:"IS_NAN"}};if(fp(n.value))return{unaryFilter:{field:Tr(n.field),op:"IS_NULL"}}}else if(n.op==="!="){if(pp(n.value))return{unaryFilter:{field:Tr(n.field),op:"IS_NOT_NAN"}};if(fp(n.value))return{unaryFilter:{field:Tr(n.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Tr(n.field),op:Fk(n.op),value:n.value}}})(t):t instanceof _t?(function(n){const r=n.getFilters().map((s=>Q_(s)));return r.length===1?r[0]:{compositeFilter:{op:Uk(n.op),filters:r}}})(t):K(54877,{filter:t})}function Bk(t){const e=[];return t.fields.forEach((n=>e.push(n.canonicalString()))),{fieldPaths:e}}function X_(t){return t.length>=4&&t.get(0)==="projects"&&t.get(2)==="databases"}function J_(t){return!!t&&typeof t._toProto=="function"&&t._protoValueType==="ProtoValue"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pn{constructor(e,n,r,s,i=Q.min(),o=Q.min(),c=je.EMPTY_BYTE_STRING,l=null){this.target=e,this.targetId=n,this.purpose=r,this.sequenceNumber=s,this.snapshotVersion=i,this.lastLimboFreeSnapshotVersion=o,this.resumeToken=c,this.expectedCount=l}withSequenceNumber(e){return new pn(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,n){return new pn(this.target,this.targetId,this.purpose,this.sequenceNumber,n,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new pn(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new pn(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jk{constructor(e){this.yt=e}}function $k(t){const e=Nk({parent:t.parent,structuredQuery:t.structuredQuery});return t.limitType==="LAST"?fl(e,e.limit,"L"):e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zk{constructor(){this.bn=new qk}addToCollectionParentIndex(e,n){return this.bn.add(n),N.resolve()}getCollectionParents(e,n){return N.resolve(this.bn.getEntries(n))}addFieldIndex(e,n){return N.resolve()}deleteFieldIndex(e,n){return N.resolve()}deleteAllFieldIndexes(e){return N.resolve()}createTargetIndexes(e,n){return N.resolve()}getDocumentsMatchingTarget(e,n){return N.resolve(null)}getIndexType(e,n){return N.resolve(0)}getFieldIndexes(e,n){return N.resolve([])}getNextCollectionGroupToUpdate(e){return N.resolve(null)}getMinOffset(e,n){return N.resolve(En.min())}getMinOffsetFromCollectionGroup(e,n){return N.resolve(En.min())}updateCollectionGroup(e,n,r){return N.resolve()}updateIndexEntries(e,n){return N.resolve()}}class qk{constructor(){this.index={}}add(e){const n=e.lastSegment(),r=e.popLast(),s=this.index[n]||new De(ue.comparator),i=!s.has(r);return this.index[n]=s.add(r),i}has(e){const n=e.lastSegment(),r=e.popLast(),s=this.index[n];return s&&s.has(r)}getEntries(e){return(this.index[e]||new De(ue.comparator)).toArray()}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pp={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},Z_=41943040;class Je{static withCacheSize(e){return new Je(e,Je.DEFAULT_COLLECTION_PERCENTILE,Je.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,n,r){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=n,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Je.DEFAULT_COLLECTION_PERCENTILE=10,Je.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,Je.DEFAULT=new Je(Z_,Je.DEFAULT_COLLECTION_PERCENTILE,Je.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),Je.DISABLED=new Je(-1,0,0);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nr{constructor(e){this.sr=e}next(){return this.sr+=2,this.sr}static _r(){return new Nr(0)}static ar(){return new Nr(-1)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Cp="LruGarbageCollector",Wk=1048576;function kp([t,e],[n,r]){const s=te(t,n);return s===0?te(e,r):s}class Hk{constructor(e){this.Pr=e,this.buffer=new De(kp),this.Tr=0}Er(){return++this.Tr}Ir(e){const n=[e,this.Er()];if(this.buffer.size<this.Pr)this.buffer=this.buffer.add(n);else{const r=this.buffer.last();kp(n,r)<0&&(this.buffer=this.buffer.delete(r).add(n))}}get maxValue(){return this.buffer.last()[0]}}class Gk{constructor(e,n,r){this.garbageCollector=e,this.asyncQueue=n,this.localStore=r,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Ar(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Ar(e){B(Cp,`Garbage collection scheduled in ${e}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,(async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(n){Kr(n)?B(Cp,"Ignoring IndexedDB error during garbage collection: ",n):await Gr(n)}await this.Ar(3e5)}))}}class Kk{constructor(e,n){this.Vr=e,this.params=n}calculateTargetCount(e,n){return this.Vr.dr(e).next((r=>Math.floor(n/100*r)))}nthSequenceNumber(e,n){if(n===0)return N.resolve(oa.ce);const r=new Hk(n);return this.Vr.forEachTarget(e,(s=>r.Ir(s.sequenceNumber))).next((()=>this.Vr.mr(e,(s=>r.Ir(s))))).next((()=>r.maxValue))}removeTargets(e,n,r){return this.Vr.removeTargets(e,n,r)}removeOrphanedDocuments(e,n){return this.Vr.removeOrphanedDocuments(e,n)}collect(e,n){return this.params.cacheSizeCollectionThreshold===-1?(B("LruGarbageCollector","Garbage collection skipped; disabled"),N.resolve(Pp)):this.getCacheSize(e).next((r=>r<this.params.cacheSizeCollectionThreshold?(B("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Pp):this.gr(e,n)))}getCacheSize(e){return this.Vr.getCacheSize(e)}gr(e,n){let r,s,i,o,c,l,u;const h=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next((f=>(f>this.params.maximumSequenceNumbersToCollect?(B("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${f}`),s=this.params.maximumSequenceNumbersToCollect):s=f,o=Date.now(),this.nthSequenceNumber(e,s)))).next((f=>(r=f,c=Date.now(),this.removeTargets(e,r,n)))).next((f=>(i=f,l=Date.now(),this.removeOrphanedDocuments(e,r)))).next((f=>(u=Date.now(),vr()<=ee.DEBUG&&B("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${o-h}ms
	Determined least recently used ${s} in `+(c-o)+`ms
	Removed ${i} targets in `+(l-c)+`ms
	Removed ${f} documents in `+(u-l)+`ms
Total Duration: ${u-h}ms`),N.resolve({didRun:!0,sequenceNumbersCollected:s,targetsRemoved:i,documentsRemoved:f}))))}}function Yk(t,e){return new Kk(t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qk{constructor(){this.changes=new hr((e=>e.toString()),((e,n)=>e.isEqual(n))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,n){this.assertNotApplied(),this.changes.set(e,We.newInvalidDocument(e).setReadTime(n))}getEntry(e,n){this.assertNotApplied();const r=this.changes.get(n);return r!==void 0?N.resolve(r):this.getFromCache(e,n)}getEntries(e,n){return this.getAllFromCache(e,n)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xk{constructor(e,n){this.overlayedDocument=e,this.mutatedFields=n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jk{constructor(e,n,r,s){this.remoteDocumentCache=e,this.mutationQueue=n,this.documentOverlayCache=r,this.indexManager=s}getDocument(e,n){let r=null;return this.documentOverlayCache.getOverlay(e,n).next((s=>(r=s,this.remoteDocumentCache.getEntry(e,n)))).next((s=>(r!==null&&Fs(r.mutation,s,rt.empty(),fe.now()),s)))}getDocuments(e,n){return this.remoteDocumentCache.getEntries(e,n).next((r=>this.getLocalViewOfDocuments(e,r,ne()).next((()=>r))))}getLocalViewOfDocuments(e,n,r=ne()){const s=Yn();return this.populateOverlays(e,s,n).next((()=>this.computeViews(e,n,s,r).next((i=>{let o=As();return i.forEach(((c,l)=>{o=o.insert(c,l.overlayedDocument)})),o}))))}getOverlayedDocuments(e,n){const r=Yn();return this.populateOverlays(e,r,n).next((()=>this.computeViews(e,n,r,ne())))}populateOverlays(e,n,r){const s=[];return r.forEach((i=>{n.has(i)||s.push(i)})),this.documentOverlayCache.getOverlays(e,s).next((i=>{i.forEach(((o,c)=>{n.set(o,c)}))}))}computeViews(e,n,r,s){let i=Gt();const o=Os(),c=(function(){return Os()})();return n.forEach(((l,u)=>{const h=r.get(u.key);s.has(u.key)&&(h===void 0||h.mutation instanceof Vn)?i=i.insert(u.key,u):h!==void 0?(o.set(u.key,h.mutation.getFieldMask()),Fs(h.mutation,u,h.mutation.getFieldMask(),fe.now())):o.set(u.key,rt.empty())})),this.recalculateAndSaveOverlays(e,i).next((l=>(l.forEach(((u,h)=>o.set(u,h))),n.forEach(((u,h)=>c.set(u,new Xk(h,o.get(u)??null)))),c)))}recalculateAndSaveOverlays(e,n){const r=Os();let s=new _e(((o,c)=>o-c)),i=ne();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,n).next((o=>{for(const c of o)c.keys().forEach((l=>{const u=n.get(l);if(u===null)return;let h=r.get(l)||rt.empty();h=c.applyToLocalView(u,h),r.set(l,h);const f=(s.get(c.batchId)||ne()).add(l);s=s.insert(c.batchId,f)}))})).next((()=>{const o=[],c=s.getReverseIterator();for(;c.hasNext();){const l=c.getNext(),u=l.key,h=l.value,f=V_();h.forEach((m=>{if(!i.has(m)){const y=B_(n.get(m),r.get(m));y!==null&&f.set(m,y),i=i.add(m)}})),o.push(this.documentOverlayCache.saveOverlays(e,u,f))}return N.waitFor(o)})).next((()=>r))}recalculateAndSaveOverlaysForDocumentKeys(e,n){return this.remoteDocumentCache.getEntries(e,n).next((r=>this.recalculateAndSaveOverlays(e,r)))}getDocumentsMatchingQuery(e,n,r,s){return ek(n)?this.getDocumentsMatchingDocumentQuery(e,n.path):S_(n)?this.getDocumentsMatchingCollectionGroupQuery(e,n,r,s):this.getDocumentsMatchingCollectionQuery(e,n,r,s)}getNextDocuments(e,n,r,s){return this.remoteDocumentCache.getAllFromCollectionGroup(e,n,r,s).next((i=>{const o=s-i.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,n,r.largestBatchId,s-i.size):N.resolve(Yn());let c=Hs,l=i;return o.next((u=>N.forEach(u,((h,f)=>(c<f.largestBatchId&&(c=f.largestBatchId),i.get(h)?N.resolve():this.remoteDocumentCache.getEntry(e,h).next((m=>{l=l.insert(h,m)}))))).next((()=>this.populateOverlays(e,u,i))).next((()=>this.computeViews(e,l,u,ne()))).next((h=>({batchId:c,changes:x_(h)})))))}))}getDocumentsMatchingDocumentQuery(e,n){return this.getDocument(e,new G(n)).next((r=>{let s=As();return r.isFoundDocument()&&(s=s.insert(r.key,r)),s}))}getDocumentsMatchingCollectionGroupQuery(e,n,r,s){const i=n.collectionGroup;let o=As();return this.indexManager.getCollectionParents(e,i).next((c=>N.forEach(c,(l=>{const u=(function(f,m){return new Yr(m,null,f.explicitOrderBy.slice(),f.filters.slice(),f.limit,f.limitType,f.startAt,f.endAt)})(n,l.child(i));return this.getDocumentsMatchingCollectionQuery(e,u,r,s).next((h=>{h.forEach(((f,m)=>{o=o.insert(f,m)}))}))})).next((()=>o))))}getDocumentsMatchingCollectionQuery(e,n,r,s){let i;return this.documentOverlayCache.getOverlaysForCollection(e,n.path,r.largestBatchId).next((o=>(i=o,this.remoteDocumentCache.getDocumentsMatchingQuery(e,n,r,i,s)))).next((o=>{i.forEach(((l,u)=>{const h=u.getKey();o.get(h)===null&&(o=o.insert(h,We.newInvalidDocument(h)))}));let c=As();return o.forEach(((l,u)=>{const h=i.get(l);h!==void 0&&Fs(h.mutation,u,rt.empty(),fe.now()),ha(n,u)&&(c=c.insert(l,u))})),c}))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zk{constructor(e){this.serializer=e,this.Nr=new Map,this.Br=new Map}getBundleMetadata(e,n){return N.resolve(this.Nr.get(n))}saveBundleMetadata(e,n){return this.Nr.set(n.id,(function(s){return{id:s.id,version:s.version,createTime:Ct(s.createTime)}})(n)),N.resolve()}getNamedQuery(e,n){return N.resolve(this.Br.get(n))}saveNamedQuery(e,n){return this.Br.set(n.name,(function(s){return{name:s.name,query:$k(s.bundledQuery),readTime:Ct(s.readTime)}})(n)),N.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ex{constructor(){this.overlays=new _e(G.comparator),this.Lr=new Map}getOverlay(e,n){return N.resolve(this.overlays.get(n))}getOverlays(e,n){const r=Yn();return N.forEach(n,(s=>this.getOverlay(e,s).next((i=>{i!==null&&r.set(s,i)})))).next((()=>r))}saveOverlays(e,n,r){return r.forEach(((s,i)=>{this.St(e,n,i)})),N.resolve()}removeOverlaysForBatchId(e,n,r){const s=this.Lr.get(r);return s!==void 0&&(s.forEach((i=>this.overlays=this.overlays.remove(i))),this.Lr.delete(r)),N.resolve()}getOverlaysForCollection(e,n,r){const s=Yn(),i=n.length+1,o=new G(n.child("")),c=this.overlays.getIteratorFrom(o);for(;c.hasNext();){const l=c.getNext().value,u=l.getKey();if(!n.isPrefixOf(u.path))break;u.path.length===i&&l.largestBatchId>r&&s.set(l.getKey(),l)}return N.resolve(s)}getOverlaysForCollectionGroup(e,n,r,s){let i=new _e(((u,h)=>u-h));const o=this.overlays.getIterator();for(;o.hasNext();){const u=o.getNext().value;if(u.getKey().getCollectionGroup()===n&&u.largestBatchId>r){let h=i.get(u.largestBatchId);h===null&&(h=Yn(),i=i.insert(u.largestBatchId,h)),h.set(u.getKey(),u)}}const c=Yn(),l=i.getIterator();for(;l.hasNext()&&(l.getNext().value.forEach(((u,h)=>c.set(u,h))),!(c.size()>=s)););return N.resolve(c)}St(e,n,r){const s=this.overlays.get(r.key);if(s!==null){const o=this.Lr.get(s.largestBatchId).delete(r.key);this.Lr.set(s.largestBatchId,o)}this.overlays=this.overlays.insert(r.key,new _k(n,r));let i=this.Lr.get(n);i===void 0&&(i=ne(),this.Lr.set(n,i)),this.Lr.set(n,i.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tx{constructor(){this.sessionToken=je.EMPTY_BYTE_STRING}getSessionToken(e){return N.resolve(this.sessionToken)}setSessionToken(e,n){return this.sessionToken=n,N.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ru{constructor(){this.kr=new De(Ne.qr),this.Kr=new De(Ne.Ur)}isEmpty(){return this.kr.isEmpty()}addReference(e,n){const r=new Ne(e,n);this.kr=this.kr.add(r),this.Kr=this.Kr.add(r)}$r(e,n){e.forEach((r=>this.addReference(r,n)))}removeReference(e,n){this.Wr(new Ne(e,n))}Qr(e,n){e.forEach((r=>this.removeReference(r,n)))}Gr(e){const n=new G(new ue([])),r=new Ne(n,e),s=new Ne(n,e+1),i=[];return this.Kr.forEachInRange([r,s],(o=>{this.Wr(o),i.push(o.key)})),i}zr(){this.kr.forEach((e=>this.Wr(e)))}Wr(e){this.kr=this.kr.delete(e),this.Kr=this.Kr.delete(e)}jr(e){const n=new G(new ue([])),r=new Ne(n,e),s=new Ne(n,e+1);let i=ne();return this.Kr.forEachInRange([r,s],(o=>{i=i.add(o.key)})),i}containsKey(e){const n=new Ne(e,0),r=this.kr.firstAfterOrEqual(n);return r!==null&&e.isEqual(r.key)}}class Ne{constructor(e,n){this.key=e,this.Jr=n}static qr(e,n){return G.comparator(e.key,n.key)||te(e.Jr,n.Jr)}static Ur(e,n){return te(e.Jr,n.Jr)||G.comparator(e.key,n.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nx{constructor(e,n){this.indexManager=e,this.referenceDelegate=n,this.mutationQueue=[],this.Yn=1,this.Hr=new De(Ne.qr)}checkEmpty(e){return N.resolve(this.mutationQueue.length===0)}addMutationBatch(e,n,r,s){const i=this.Yn;this.Yn++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const o=new yk(i,n,r,s);this.mutationQueue.push(o);for(const c of s)this.Hr=this.Hr.add(new Ne(c.key,i)),this.indexManager.addToCollectionParentIndex(e,c.key.path.popLast());return N.resolve(o)}lookupMutationBatch(e,n){return N.resolve(this.Zr(n))}getNextMutationBatchAfterBatchId(e,n){const r=n+1,s=this.Xr(r),i=s<0?0:s;return N.resolve(this.mutationQueue.length>i?this.mutationQueue[i]:null)}getHighestUnacknowledgedBatchId(){return N.resolve(this.mutationQueue.length===0?yu:this.Yn-1)}getAllMutationBatches(e){return N.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,n){const r=new Ne(n,0),s=new Ne(n,Number.POSITIVE_INFINITY),i=[];return this.Hr.forEachInRange([r,s],(o=>{const c=this.Zr(o.Jr);i.push(c)})),N.resolve(i)}getAllMutationBatchesAffectingDocumentKeys(e,n){let r=new De(te);return n.forEach((s=>{const i=new Ne(s,0),o=new Ne(s,Number.POSITIVE_INFINITY);this.Hr.forEachInRange([i,o],(c=>{r=r.add(c.Jr)}))})),N.resolve(this.Yr(r))}getAllMutationBatchesAffectingQuery(e,n){const r=n.path,s=r.length+1;let i=r;G.isDocumentKey(i)||(i=i.child(""));const o=new Ne(new G(i),0);let c=new De(te);return this.Hr.forEachWhile((l=>{const u=l.key.path;return!!r.isPrefixOf(u)&&(u.length===s&&(c=c.add(l.Jr)),!0)}),o),N.resolve(this.Yr(c))}Yr(e){const n=[];return e.forEach((r=>{const s=this.Zr(r);s!==null&&n.push(s)})),n}removeMutationBatch(e,n){oe(this.ei(n.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Hr;return N.forEach(n.mutations,(s=>{const i=new Ne(s.key,n.batchId);return r=r.delete(i),this.referenceDelegate.markPotentiallyOrphaned(e,s.key)})).next((()=>{this.Hr=r}))}nr(e){}containsKey(e,n){const r=new Ne(n,0),s=this.Hr.firstAfterOrEqual(r);return N.resolve(n.isEqual(s&&s.key))}performConsistencyCheck(e){return this.mutationQueue.length,N.resolve()}ei(e,n){return this.Xr(e)}Xr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Zr(e){const n=this.Xr(e);return n<0||n>=this.mutationQueue.length?null:this.mutationQueue[n]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rx{constructor(e){this.ti=e,this.docs=(function(){return new _e(G.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,n){const r=n.key,s=this.docs.get(r),i=s?s.size:0,o=this.ti(n);return this.docs=this.docs.insert(r,{document:n.mutableCopy(),size:o}),this.size+=o-i,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const n=this.docs.get(e);n&&(this.docs=this.docs.remove(e),this.size-=n.size)}getEntry(e,n){const r=this.docs.get(n);return N.resolve(r?r.document.mutableCopy():We.newInvalidDocument(n))}getEntries(e,n){let r=Gt();return n.forEach((s=>{const i=this.docs.get(s);r=r.insert(s,i?i.document.mutableCopy():We.newInvalidDocument(s))})),N.resolve(r)}getDocumentsMatchingQuery(e,n,r,s){let i=Gt();const o=n.path,c=new G(o.child("__id-9223372036854775808__")),l=this.docs.getIteratorFrom(c);for(;l.hasNext();){const{key:u,value:{document:h}}=l.getNext();if(!o.isPrefixOf(u.path))break;u.path.length>o.length+1||k1(C1(h),r)<=0||(s.has(h.key)||ha(n,h))&&(i=i.insert(h.key,h.mutableCopy()))}return N.resolve(i)}getAllFromCollectionGroup(e,n,r,s){K(9500)}ni(e,n){return N.forEach(this.docs,(r=>n(r)))}newChangeBuffer(e){return new sx(this)}getSize(e){return N.resolve(this.size)}}class sx extends Qk{constructor(e){super(),this.Mr=e}applyChanges(e){const n=[];return this.changes.forEach(((r,s)=>{s.isValidDocument()?n.push(this.Mr.addEntry(e,s)):this.Mr.removeEntry(r)})),N.waitFor(n)}getFromCache(e,n){return this.Mr.getEntry(e,n)}getAllFromCache(e,n){return this.Mr.getEntries(e,n)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ix{constructor(e){this.persistence=e,this.ri=new hr((n=>wu(n)),Tu),this.lastRemoteSnapshotVersion=Q.min(),this.highestTargetId=0,this.ii=0,this.si=new Ru,this.targetCount=0,this.oi=Nr._r()}forEachTarget(e,n){return this.ri.forEach(((r,s)=>n(s))),N.resolve()}getLastRemoteSnapshotVersion(e){return N.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return N.resolve(this.ii)}allocateTargetId(e){return this.highestTargetId=this.oi.next(),N.resolve(this.highestTargetId)}setTargetsMetadata(e,n,r){return r&&(this.lastRemoteSnapshotVersion=r),n>this.ii&&(this.ii=n),N.resolve()}lr(e){this.ri.set(e.target,e);const n=e.targetId;n>this.highestTargetId&&(this.oi=new Nr(n),this.highestTargetId=n),e.sequenceNumber>this.ii&&(this.ii=e.sequenceNumber)}addTargetData(e,n){return this.lr(n),this.targetCount+=1,N.resolve()}updateTargetData(e,n){return this.lr(n),N.resolve()}removeTargetData(e,n){return this.ri.delete(n.target),this.si.Gr(n.targetId),this.targetCount-=1,N.resolve()}removeTargets(e,n,r){let s=0;const i=[];return this.ri.forEach(((o,c)=>{c.sequenceNumber<=n&&r.get(c.targetId)===null&&(this.ri.delete(o),i.push(this.removeMatchingKeysForTargetId(e,c.targetId)),s++)})),N.waitFor(i).next((()=>s))}getTargetCount(e){return N.resolve(this.targetCount)}getTargetData(e,n){const r=this.ri.get(n)||null;return N.resolve(r)}addMatchingKeys(e,n,r){return this.si.$r(n,r),N.resolve()}removeMatchingKeys(e,n,r){this.si.Qr(n,r);const s=this.persistence.referenceDelegate,i=[];return s&&n.forEach((o=>{i.push(s.markPotentiallyOrphaned(e,o))})),N.waitFor(i)}removeMatchingKeysForTargetId(e,n){return this.si.Gr(n),N.resolve()}getMatchingKeysForTargetId(e,n){const r=this.si.jr(n);return N.resolve(r)}containsKey(e,n){return N.resolve(this.si.containsKey(n))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ev{constructor(e,n){this._i={},this.overlays={},this.ai=new oa(0),this.ui=!1,this.ui=!0,this.ci=new tx,this.referenceDelegate=e(this),this.li=new ix(this),this.indexManager=new zk,this.remoteDocumentCache=(function(s){return new rx(s)})((r=>this.referenceDelegate.hi(r))),this.serializer=new jk(n),this.Pi=new Zk(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ui=!1,Promise.resolve()}get started(){return this.ui}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let n=this.overlays[e.toKey()];return n||(n=new ex,this.overlays[e.toKey()]=n),n}getMutationQueue(e,n){let r=this._i[e.toKey()];return r||(r=new nx(n,this.referenceDelegate),this._i[e.toKey()]=r),r}getGlobalsCache(){return this.ci}getTargetCache(){return this.li}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Pi}runTransaction(e,n,r){B("MemoryPersistence","Starting transaction:",e);const s=new ox(this.ai.next());return this.referenceDelegate.Ti(),r(s).next((i=>this.referenceDelegate.Ei(s).next((()=>i)))).toPromise().then((i=>(s.raiseOnCommittedEvent(),i)))}Ii(e,n){return N.or(Object.values(this._i).map((r=>()=>r.containsKey(e,n))))}}class ox extends V1{constructor(e){super(),this.currentSequenceNumber=e}}class Su{constructor(e){this.persistence=e,this.Ri=new Ru,this.Ai=null}static Vi(e){return new Su(e)}get di(){if(this.Ai)return this.Ai;throw K(60996)}addReference(e,n,r){return this.Ri.addReference(r,n),this.di.delete(r.toString()),N.resolve()}removeReference(e,n,r){return this.Ri.removeReference(r,n),this.di.add(r.toString()),N.resolve()}markPotentiallyOrphaned(e,n){return this.di.add(n.toString()),N.resolve()}removeTarget(e,n){this.Ri.Gr(n.targetId).forEach((s=>this.di.add(s.toString())));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,n.targetId).next((s=>{s.forEach((i=>this.di.add(i.toString())))})).next((()=>r.removeTargetData(e,n)))}Ti(){this.Ai=new Set}Ei(e){const n=this.persistence.getRemoteDocumentCache().newChangeBuffer();return N.forEach(this.di,(r=>{const s=G.fromPath(r);return this.mi(e,s).next((i=>{i||n.removeEntry(s,Q.min())}))})).next((()=>(this.Ai=null,n.apply(e))))}updateLimboDocument(e,n){return this.mi(e,n).next((r=>{r?this.di.delete(n.toString()):this.di.add(n.toString())}))}hi(e){return 0}mi(e,n){return N.or([()=>N.resolve(this.Ri.containsKey(n)),()=>this.persistence.getTargetCache().containsKey(e,n),()=>this.persistence.Ii(e,n)])}}class No{constructor(e,n){this.persistence=e,this.fi=new hr((r=>N1(r.path)),((r,s)=>r.isEqual(s))),this.garbageCollector=Yk(this,n)}static Vi(e,n){return new No(e,n)}Ti(){}Ei(e){return N.resolve()}forEachTarget(e,n){return this.persistence.getTargetCache().forEachTarget(e,n)}dr(e){const n=this.pr(e);return this.persistence.getTargetCache().getTargetCount(e).next((r=>n.next((s=>r+s))))}pr(e){let n=0;return this.mr(e,(r=>{n++})).next((()=>n))}mr(e,n){return N.forEach(this.fi,((r,s)=>this.wr(e,r,s).next((i=>i?N.resolve():n(s)))))}removeTargets(e,n,r){return this.persistence.getTargetCache().removeTargets(e,n,r)}removeOrphanedDocuments(e,n){let r=0;const s=this.persistence.getRemoteDocumentCache(),i=s.newChangeBuffer();return s.ni(e,(o=>this.wr(e,o,n).next((c=>{c||(r++,i.removeEntry(o,Q.min()))})))).next((()=>i.apply(e))).next((()=>r))}markPotentiallyOrphaned(e,n){return this.fi.set(n,e.currentSequenceNumber),N.resolve()}removeTarget(e,n){const r=n.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,r)}addReference(e,n,r){return this.fi.set(r,e.currentSequenceNumber),N.resolve()}removeReference(e,n,r){return this.fi.set(r,e.currentSequenceNumber),N.resolve()}updateLimboDocument(e,n){return this.fi.set(n,e.currentSequenceNumber),N.resolve()}hi(e){let n=e.key.toString().length;return e.isFoundDocument()&&(n+=ao(e.data.value)),n}wr(e,n,r){return N.or([()=>this.persistence.Ii(e,n),()=>this.persistence.getTargetCache().containsKey(e,n),()=>{const s=this.fi.get(n);return N.resolve(s!==void 0&&s>r)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pu{constructor(e,n,r,s){this.targetId=e,this.fromCache=n,this.Ts=r,this.Es=s}static Is(e,n){let r=ne(),s=ne();for(const i of n.docChanges)switch(i.type){case 0:r=r.add(i.doc.key);break;case 1:s=s.add(i.doc.key)}return new Pu(e,n.fromCache,r,s)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ax{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cx{constructor(){this.Rs=!1,this.As=!1,this.Vs=100,this.ds=(function(){return XP()?8:D1(He())>0?6:4})()}initialize(e,n){this.fs=e,this.indexManager=n,this.Rs=!0}getDocumentsMatchingQuery(e,n,r,s){const i={result:null};return this.gs(e,n).next((o=>{i.result=o})).next((()=>{if(!i.result)return this.ps(e,n,s,r).next((o=>{i.result=o}))})).next((()=>{if(i.result)return;const o=new ax;return this.ys(e,n,o).next((c=>{if(i.result=c,this.As)return this.ws(e,n,o,c.size)}))})).next((()=>i.result))}ws(e,n,r,s){return r.documentReadCount<this.Vs?(vr()<=ee.DEBUG&&B("QueryEngine","SDK will not create cache indexes for query:",wr(n),"since it only creates cache indexes for collection contains","more than or equal to",this.Vs,"documents"),N.resolve()):(vr()<=ee.DEBUG&&B("QueryEngine","Query:",wr(n),"scans",r.documentReadCount,"local documents and returns",s,"documents as results."),r.documentReadCount>this.ds*s?(vr()<=ee.DEBUG&&B("QueryEngine","The SDK decides to create cache indexes for query:",wr(n),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,Pt(n))):N.resolve())}gs(e,n){if(_p(n))return N.resolve(null);let r=Pt(n);return this.indexManager.getIndexType(e,r).next((s=>s===0?null:(n.limit!==null&&s===1&&(n=fl(n,null,"F"),r=Pt(n)),this.indexManager.getDocumentsMatchingTarget(e,r).next((i=>{const o=ne(...i);return this.fs.getDocuments(e,o).next((c=>this.indexManager.getMinOffset(e,r).next((l=>{const u=this.Ss(n,c);return this.bs(n,u,o,l.readTime)?this.gs(e,fl(n,null,"F")):this.Ds(e,u,n,l)}))))})))))}ps(e,n,r,s){return _p(n)||s.isEqual(Q.min())?N.resolve(null):this.fs.getDocuments(e,r).next((i=>{const o=this.Ss(n,i);return this.bs(n,o,r,s)?N.resolve(null):(vr()<=ee.DEBUG&&B("QueryEngine","Re-using previous result from %s to execute query: %s",s.toString(),wr(n)),this.Ds(e,o,n,P1(s,Hs)).next((c=>c)))}))}Ss(e,n){let r=new De(C_(e));return n.forEach(((s,i)=>{ha(e,i)&&(r=r.add(i))})),r}bs(e,n,r,s){if(e.limit===null)return!1;if(r.size!==n.size)return!0;const i=e.limitType==="F"?n.last():n.first();return!!i&&(i.hasPendingWrites||i.version.compareTo(s)>0)}ys(e,n,r){return vr()<=ee.DEBUG&&B("QueryEngine","Using full collection scan to execute query:",wr(n)),this.fs.getDocumentsMatchingQuery(e,n,En.min(),r)}Ds(e,n,r,s){return this.fs.getDocumentsMatchingQuery(e,r,s).next((i=>(n.forEach((o=>{i=i.insert(o.key,o)})),i)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Cu="LocalStore",lx=3e8;class ux{constructor(e,n,r,s){this.persistence=e,this.Cs=n,this.serializer=s,this.vs=new _e(te),this.Fs=new hr((i=>wu(i)),Tu),this.Ms=new Map,this.xs=e.getRemoteDocumentCache(),this.li=e.getTargetCache(),this.Pi=e.getBundleCache(),this.Os(r)}Os(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new Jk(this.xs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.xs.setIndexManager(this.indexManager),this.Cs.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(n=>e.collect(n,this.vs)))}}function hx(t,e,n,r){return new ux(t,e,n,r)}async function tv(t,e){const n=X(t);return await n.persistence.runTransaction("Handle user change","readonly",(r=>{let s;return n.mutationQueue.getAllMutationBatches(r).next((i=>(s=i,n.Os(e),n.mutationQueue.getAllMutationBatches(r)))).next((i=>{const o=[],c=[];let l=ne();for(const u of s){o.push(u.batchId);for(const h of u.mutations)l=l.add(h.key)}for(const u of i){c.push(u.batchId);for(const h of u.mutations)l=l.add(h.key)}return n.localDocuments.getDocuments(r,l).next((u=>({Ns:u,removedBatchIds:o,addedBatchIds:c})))}))}))}function dx(t,e){const n=X(t);return n.persistence.runTransaction("Acknowledge batch","readwrite-primary",(r=>{const s=e.batch.keys(),i=n.xs.newChangeBuffer({trackRemovals:!0});return(function(c,l,u,h){const f=u.batch,m=f.keys();let y=N.resolve();return m.forEach((w=>{y=y.next((()=>h.getEntry(l,w))).next((R=>{const I=u.docVersions.get(w);oe(I!==null,48541),R.version.compareTo(I)<0&&(f.applyToRemoteDocument(R,u),R.isValidDocument()&&(R.setReadTime(u.commitVersion),h.addEntry(R)))}))})),y.next((()=>c.mutationQueue.removeMutationBatch(l,f)))})(n,r,e,i).next((()=>i.apply(r))).next((()=>n.mutationQueue.performConsistencyCheck(r))).next((()=>n.documentOverlayCache.removeOverlaysForBatchId(r,s,e.batch.batchId))).next((()=>n.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,(function(c){let l=ne();for(let u=0;u<c.mutationResults.length;++u)c.mutationResults[u].transformResults.length>0&&(l=l.add(c.batch.mutations[u].key));return l})(e)))).next((()=>n.localDocuments.getDocuments(r,s)))}))}function nv(t){const e=X(t);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(n=>e.li.getLastRemoteSnapshotVersion(n)))}function fx(t,e){const n=X(t),r=e.snapshotVersion;let s=n.vs;return n.persistence.runTransaction("Apply remote event","readwrite-primary",(i=>{const o=n.xs.newChangeBuffer({trackRemovals:!0});s=n.vs;const c=[];e.targetChanges.forEach(((h,f)=>{const m=s.get(f);if(!m)return;c.push(n.li.removeMatchingKeys(i,h.removedDocuments,f).next((()=>n.li.addMatchingKeys(i,h.addedDocuments,f))));let y=m.withSequenceNumber(i.currentSequenceNumber);e.targetMismatches.get(f)!==null?y=y.withResumeToken(je.EMPTY_BYTE_STRING,Q.min()).withLastLimboFreeSnapshotVersion(Q.min()):h.resumeToken.approximateByteSize()>0&&(y=y.withResumeToken(h.resumeToken,r)),s=s.insert(f,y),(function(R,I,P){return R.resumeToken.approximateByteSize()===0||I.snapshotVersion.toMicroseconds()-R.snapshotVersion.toMicroseconds()>=lx?!0:P.addedDocuments.size+P.modifiedDocuments.size+P.removedDocuments.size>0})(m,y,h)&&c.push(n.li.updateTargetData(i,y))}));let l=Gt(),u=ne();if(e.documentUpdates.forEach((h=>{e.resolvedLimboDocuments.has(h)&&c.push(n.persistence.referenceDelegate.updateLimboDocument(i,h))})),c.push(px(i,o,e.documentUpdates).next((h=>{l=h.Bs,u=h.Ls}))),!r.isEqual(Q.min())){const h=n.li.getLastRemoteSnapshotVersion(i).next((f=>n.li.setTargetsMetadata(i,i.currentSequenceNumber,r)));c.push(h)}return N.waitFor(c).next((()=>o.apply(i))).next((()=>n.localDocuments.getLocalViewOfDocuments(i,l,u))).next((()=>l))})).then((i=>(n.vs=s,i)))}function px(t,e,n){let r=ne(),s=ne();return n.forEach((i=>r=r.add(i))),e.getEntries(t,r).next((i=>{let o=Gt();return n.forEach(((c,l)=>{const u=i.get(c);l.isFoundDocument()!==u.isFoundDocument()&&(s=s.add(c)),l.isNoDocument()&&l.version.isEqual(Q.min())?(e.removeEntry(c,l.readTime),o=o.insert(c,l)):!u.isValidDocument()||l.version.compareTo(u.version)>0||l.version.compareTo(u.version)===0&&u.hasPendingWrites?(e.addEntry(l),o=o.insert(c,l)):B(Cu,"Ignoring outdated watch update for ",c,". Current version:",u.version," Watch version:",l.version)})),{Bs:o,Ls:s}}))}function mx(t,e){const n=X(t);return n.persistence.runTransaction("Get next mutation batch","readonly",(r=>(e===void 0&&(e=yu),n.mutationQueue.getNextMutationBatchAfterBatchId(r,e))))}function gx(t,e){const n=X(t);return n.persistence.runTransaction("Allocate target","readwrite",(r=>{let s;return n.li.getTargetData(r,e).next((i=>i?(s=i,N.resolve(s)):n.li.allocateTargetId(r).next((o=>(s=new pn(e,o,"TargetPurposeListen",r.currentSequenceNumber),n.li.addTargetData(r,s).next((()=>s)))))))})).then((r=>{const s=n.vs.get(r.targetId);return(s===null||r.snapshotVersion.compareTo(s.snapshotVersion)>0)&&(n.vs=n.vs.insert(r.targetId,r),n.Fs.set(e,r.targetId)),r}))}async function _l(t,e,n){const r=X(t),s=r.vs.get(e),i=n?"readwrite":"readwrite-primary";try{n||await r.persistence.runTransaction("Release target",i,(o=>r.persistence.referenceDelegate.removeTarget(o,s)))}catch(o){if(!Kr(o))throw o;B(Cu,`Failed to update sequence numbers for target ${e}: ${o}`)}r.vs=r.vs.remove(e),r.Fs.delete(s.target)}function xp(t,e,n){const r=X(t);let s=Q.min(),i=ne();return r.persistence.runTransaction("Execute query","readwrite",(o=>(function(l,u,h){const f=X(l),m=f.Fs.get(h);return m!==void 0?N.resolve(f.vs.get(m)):f.li.getTargetData(u,h)})(r,o,Pt(e)).next((c=>{if(c)return s=c.lastLimboFreeSnapshotVersion,r.li.getMatchingKeysForTargetId(o,c.targetId).next((l=>{i=l}))})).next((()=>r.Cs.getDocumentsMatchingQuery(o,e,n?s:Q.min(),n?i:ne()))).next((c=>(yx(r,rk(e),c),{documents:c,ks:i})))))}function yx(t,e,n){let r=t.Ms.get(e)||Q.min();n.forEach(((s,i)=>{i.readTime.compareTo(r)>0&&(r=i.readTime)})),t.Ms.set(e,r)}class Vp{constructor(){this.activeTargetIds=lk()}Qs(e){this.activeTargetIds=this.activeTargetIds.add(e)}Gs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Ws(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class _x{constructor(){this.vo=new Vp,this.Fo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,n,r){}addLocalQueryTarget(e,n=!0){return n&&this.vo.Qs(e),this.Fo[e]||"not-current"}updateQueryState(e,n,r){this.Fo[e]=n}removeLocalQueryTarget(e){this.vo.Gs(e)}isLocalQueryTarget(e){return this.vo.activeTargetIds.has(e)}clearQueryState(e){delete this.Fo[e]}getAllActiveQueryTargets(){return this.vo.activeTargetIds}isActiveQueryTarget(e){return this.vo.activeTargetIds.has(e)}start(){return this.vo=new Vp,Promise.resolve()}handleUserChange(e,n,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vx{Mo(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Dp="ConnectivityMonitor";class Mp{constructor(){this.xo=()=>this.Oo(),this.No=()=>this.Bo(),this.Lo=[],this.ko()}Mo(e){this.Lo.push(e)}shutdown(){window.removeEventListener("online",this.xo),window.removeEventListener("offline",this.No)}ko(){window.addEventListener("online",this.xo),window.addEventListener("offline",this.No)}Oo(){B(Dp,"Network connectivity changed: AVAILABLE");for(const e of this.Lo)e(0)}Bo(){B(Dp,"Network connectivity changed: UNAVAILABLE");for(const e of this.Lo)e(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ki=null;function vl(){return Ki===null?Ki=(function(){return 268435456+Math.round(2147483648*Math.random())})():Ki++,"0x"+Ki.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Tc="RestConnection",wx={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"};class Tx{get qo(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const n=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.Ko=n+"://"+e.host,this.Uo=`projects/${r}/databases/${s}`,this.$o=this.databaseId.database===xo?`project_id=${r}`:`project_id=${r}&database_id=${s}`}Wo(e,n,r,s,i){const o=vl(),c=this.Qo(e,n.toUriEncodedString());B(Tc,`Sending RPC '${e}' ${o}:`,c,r);const l={"google-cloud-resource-prefix":this.Uo,"x-goog-request-params":this.$o};this.Go(l,s,i);const{host:u}=new URL(c),h=ur(u);return this.zo(e,c,l,r,h).then((f=>(B(Tc,`Received RPC '${e}' ${o}: `,f),f)),(f=>{throw ir(Tc,`RPC '${e}' ${o} failed with error: `,f,"url: ",c,"request:",r),f}))}jo(e,n,r,s,i,o){return this.Wo(e,n,r,s,i)}Go(e,n,r){e["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+Hr})(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),n&&n.headers.forEach(((s,i)=>e[i]=s)),r&&r.headers.forEach(((s,i)=>e[i]=s))}Qo(e,n){const r=wx[e];let s=`${this.Ko}/v1/${n}:${r}`;return this.databaseInfo.apiKey&&(s=`${s}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),s}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ex{constructor(e){this.Jo=e.Jo,this.Ho=e.Ho}Zo(e){this.Xo=e}Yo(e){this.e_=e}t_(e){this.n_=e}onMessage(e){this.r_=e}close(){this.Ho()}send(e){this.Jo(e)}i_(){this.Xo()}s_(){this.e_()}o_(e){this.n_(e)}__(e){this.r_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ze="WebChannelConnection",Ts=(t,e,n)=>{t.listen(e,(r=>{try{n(r)}catch(s){setTimeout((()=>{throw s}),0)}}))};class Rr extends Tx{constructor(e){super(e),this.a_=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}static u_(){if(!Rr.c_){const e=i_();Ts(e,s_.STAT_EVENT,(n=>{n.stat===ol.PROXY?B(ze,"STAT_EVENT: detected buffering proxy"):n.stat===ol.NOPROXY&&B(ze,"STAT_EVENT: detected no buffering proxy")})),Rr.c_=!0}}zo(e,n,r,s,i){const o=vl();return new Promise(((c,l)=>{const u=new n_;u.setWithCredentials(!0),u.listenOnce(r_.COMPLETE,(()=>{try{switch(u.getLastErrorCode()){case oo.NO_ERROR:const f=u.getResponseJson();B(ze,`XHR for RPC '${e}' ${o} received:`,JSON.stringify(f)),c(f);break;case oo.TIMEOUT:B(ze,`RPC '${e}' ${o} timed out`),l(new U(M.DEADLINE_EXCEEDED,"Request time out"));break;case oo.HTTP_ERROR:const m=u.getStatus();if(B(ze,`RPC '${e}' ${o} failed with status:`,m,"response text:",u.getResponseText()),m>0){let y=u.getResponseJson();Array.isArray(y)&&(y=y[0]);const w=y==null?void 0:y.error;if(w&&w.status&&w.message){const R=(function(P){const x=P.toLowerCase().replace(/_/g,"-");return Object.values(M).indexOf(x)>=0?x:M.UNKNOWN})(w.status);l(new U(R,w.message))}else l(new U(M.UNKNOWN,"Server responded with status "+u.getStatus()))}else l(new U(M.UNAVAILABLE,"Connection failed."));break;default:K(9055,{l_:e,streamId:o,h_:u.getLastErrorCode(),P_:u.getLastError()})}}finally{B(ze,`RPC '${e}' ${o} completed.`)}}));const h=JSON.stringify(s);B(ze,`RPC '${e}' ${o} sending request:`,s),u.send(n,"POST",h,r,15)}))}T_(e,n,r){const s=vl(),i=[this.Ko,"/","google.firestore.v1.Firestore","/",e,"/channel"],o=this.createWebChannelTransport(),c={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},l=this.longPollingOptions.timeoutSeconds;l!==void 0&&(c.longPollingTimeout=Math.round(1e3*l)),this.useFetchStreams&&(c.useFetchStreams=!0),this.Go(c.initMessageHeaders,n,r),c.encodeInitMessageHeaders=!0;const u=i.join("");B(ze,`Creating RPC '${e}' stream ${s}: ${u}`,c);const h=o.createWebChannel(u,c);this.E_(h);let f=!1,m=!1;const y=new Ex({Jo:w=>{m?B(ze,`Not sending because RPC '${e}' stream ${s} is closed:`,w):(f||(B(ze,`Opening RPC '${e}' stream ${s} transport.`),h.open(),f=!0),B(ze,`RPC '${e}' stream ${s} sending:`,w),h.send(w))},Ho:()=>h.close()});return Ts(h,bs.EventType.OPEN,(()=>{m||(B(ze,`RPC '${e}' stream ${s} transport opened.`),y.i_())})),Ts(h,bs.EventType.CLOSE,(()=>{m||(m=!0,B(ze,`RPC '${e}' stream ${s} transport closed`),y.o_(),this.I_(h))})),Ts(h,bs.EventType.ERROR,(w=>{m||(m=!0,ir(ze,`RPC '${e}' stream ${s} transport errored. Name:`,w.name,"Message:",w.message),y.o_(new U(M.UNAVAILABLE,"The operation could not be completed")))})),Ts(h,bs.EventType.MESSAGE,(w=>{var R;if(!m){const I=w.data[0];oe(!!I,16349);const P=I,x=(P==null?void 0:P.error)||((R=P[0])==null?void 0:R.error);if(x){B(ze,`RPC '${e}' stream ${s} received error:`,x);const V=x.status;let L=(function(b){const g=be[b];if(g!==void 0)return $_(g)})(V),O=x.message;V==="NOT_FOUND"&&O.includes("database")&&O.includes("does not exist")&&O.includes(this.databaseId.database)&&ir(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),L===void 0&&(L=M.INTERNAL,O="Unknown error status: "+V+" with message "+x.message),m=!0,y.o_(new U(L,O)),h.close()}else B(ze,`RPC '${e}' stream ${s} received:`,I),y.__(I)}})),Rr.u_(),setTimeout((()=>{y.s_()}),0),y}terminate(){this.a_.forEach((e=>e.close())),this.a_=[]}E_(e){this.a_.push(e)}I_(e){this.a_=this.a_.filter((n=>n===e))}Go(e,n,r){super.Go(e,n,r),this.databaseInfo.apiKey&&(e["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return o_()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ix(t){return new Rr(t)}function Ec(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ga(t){return new Sk(t,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Rr.c_=!1;class rv{constructor(e,n,r=1e3,s=1.5,i=6e4){this.Ci=e,this.timerId=n,this.R_=r,this.A_=s,this.V_=i,this.d_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.d_=0}g_(){this.d_=this.V_}p_(e){this.cancel();const n=Math.floor(this.d_+this.y_()),r=Math.max(0,Date.now()-this.f_),s=Math.max(0,n-r);s>0&&B("ExponentialBackoff",`Backing off for ${s} ms (base delay: ${this.d_} ms, delay with jitter: ${n} ms, last attempt: ${r} ms ago)`),this.m_=this.Ci.enqueueAfterDelay(this.timerId,s,(()=>(this.f_=Date.now(),e()))),this.d_*=this.A_,this.d_<this.R_&&(this.d_=this.R_),this.d_>this.V_&&(this.d_=this.V_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.d_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Np="PersistentStream";class sv{constructor(e,n,r,s,i,o,c,l){this.Ci=e,this.S_=r,this.b_=s,this.connection=i,this.authCredentialsProvider=o,this.appCheckCredentialsProvider=c,this.listener=l,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new rv(e,n)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Ci.enqueueAfterDelay(this.S_,6e4,(()=>this.k_())))}q_(e){this.K_(),this.stream.send(e)}async k_(){if(this.O_())return this.close(0)}K_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(e,n){this.K_(),this.U_(),this.M_.cancel(),this.D_++,e!==4?this.M_.reset():n&&n.code===M.RESOURCE_EXHAUSTED?(Ht(n.toString()),Ht("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):n&&n.code===M.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.W_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.t_(n)}W_(){}auth(){this.state=1;const e=this.Q_(this.D_),n=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([r,s])=>{this.D_===n&&this.G_(r,s)}),(r=>{e((()=>{const s=new U(M.UNKNOWN,"Fetching auth token failed: "+r.message);return this.z_(s)}))}))}G_(e,n){const r=this.Q_(this.D_);this.stream=this.j_(e,n),this.stream.Zo((()=>{r((()=>this.listener.Zo()))})),this.stream.Yo((()=>{r((()=>(this.state=2,this.v_=this.Ci.enqueueAfterDelay(this.b_,1e4,(()=>(this.O_()&&(this.state=3),Promise.resolve()))),this.listener.Yo())))})),this.stream.t_((s=>{r((()=>this.z_(s)))})),this.stream.onMessage((s=>{r((()=>++this.F_==1?this.J_(s):this.onNext(s)))}))}N_(){this.state=5,this.M_.p_((async()=>{this.state=0,this.start()}))}z_(e){return B(Np,`close with error: ${e}`),this.stream=null,this.close(4,e)}Q_(e){return n=>{this.Ci.enqueueAndForget((()=>this.D_===e?n():(B(Np,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class bx extends sv{constructor(e,n,r,s,i,o){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",n,r,s,o),this.serializer=i}j_(e,n){return this.connection.T_("Listen",e,n)}J_(e){return this.onNext(e)}onNext(e){this.M_.reset();const n=kk(this.serializer,e),r=(function(i){if(!("targetChange"in i))return Q.min();const o=i.targetChange;return o.targetIds&&o.targetIds.length?Q.min():o.readTime?Ct(o.readTime):Q.min()})(e);return this.listener.H_(n,r)}Z_(e){const n={};n.database=yl(this.serializer),n.addTarget=(function(i,o){let c;const l=o.target;if(c=hl(l)?{documents:Dk(i,l)}:{query:Mk(i,l).ft},c.targetId=o.targetId,o.resumeToken.approximateByteSize()>0){c.resumeToken=W_(i,o.resumeToken);const u=pl(i,o.expectedCount);u!==null&&(c.expectedCount=u)}else if(o.snapshotVersion.compareTo(Q.min())>0){c.readTime=Mo(i,o.snapshotVersion.toTimestamp());const u=pl(i,o.expectedCount);u!==null&&(c.expectedCount=u)}return c})(this.serializer,e);const r=Lk(this.serializer,e);r&&(n.labels=r),this.q_(n)}X_(e){const n={};n.database=yl(this.serializer),n.removeTarget=e,this.q_(n)}}class Ax extends sv{constructor(e,n,r,s,i,o){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",n,r,s,o),this.serializer=i}get Y_(){return this.F_>0}start(){this.lastStreamToken=void 0,super.start()}W_(){this.Y_&&this.ea([])}j_(e,n){return this.connection.T_("Write",e,n)}J_(e){return oe(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,oe(!e.writeResults||e.writeResults.length===0,55816),this.listener.ta()}onNext(e){oe(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.M_.reset();const n=Vk(e.writeResults,e.commitTime),r=Ct(e.commitTime);return this.listener.na(r,n)}ra(){const e={};e.database=yl(this.serializer),this.q_(e)}ea(e){const n={streamToken:this.lastStreamToken,writes:e.map((r=>xk(this.serializer,r)))};this.q_(n)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rx{}class Sx extends Rx{constructor(e,n,r,s){super(),this.authCredentials=e,this.appCheckCredentials=n,this.connection=r,this.serializer=s,this.ia=!1}sa(){if(this.ia)throw new U(M.FAILED_PRECONDITION,"The client has already been terminated.")}Wo(e,n,r,s){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([i,o])=>this.connection.Wo(e,ml(n,r),s,i,o))).catch((i=>{throw i.name==="FirebaseError"?(i.code===M.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),i):new U(M.UNKNOWN,i.toString())}))}jo(e,n,r,s,i){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,c])=>this.connection.jo(e,ml(n,r),s,o,c,i))).catch((o=>{throw o.name==="FirebaseError"?(o.code===M.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new U(M.UNKNOWN,o.toString())}))}terminate(){this.ia=!0,this.connection.terminate()}}function Px(t,e,n,r){return new Sx(t,e,n,r)}class Cx{constructor(e,n){this.asyncQueue=e,this.onlineStateHandler=n,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve()))))}ha(e){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ca("Offline")))}set(e){this.Pa(),this.oa=0,e==="Online"&&(this.aa=!1),this.ca(e)}ca(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}la(e){const n=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(Ht(n),this.aa=!1):B("OnlineStateTracker",n)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const or="RemoteStore";class kx{constructor(e,n,r,s,i){this.localStore=e,this.datastore=n,this.asyncQueue=r,this.remoteSyncer={},this.Ta=[],this.Ea=new Map,this.Ia=new Set,this.Ra=[],this.Aa=i,this.Aa.Mo((o=>{r.enqueueAndForget((async()=>{dr(this)&&(B(or,"Restarting streams for network reachability change."),await(async function(l){const u=X(l);u.Ia.add(4),await fi(u),u.Va.set("Unknown"),u.Ia.delete(4),await ya(u)})(this))}))})),this.Va=new Cx(r,s)}}async function ya(t){if(dr(t))for(const e of t.Ra)await e(!0)}async function fi(t){for(const e of t.Ra)await e(!1)}function iv(t,e){const n=X(t);n.Ea.has(e.targetId)||(n.Ea.set(e.targetId,e),Du(n)?Vu(n):Qr(n).O_()&&xu(n,e))}function ku(t,e){const n=X(t),r=Qr(n);n.Ea.delete(e),r.O_()&&ov(n,e),n.Ea.size===0&&(r.O_()?r.L_():dr(n)&&n.Va.set("Unknown"))}function xu(t,e){if(t.da.$e(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(Q.min())>0){const n=t.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(n)}Qr(t).Z_(e)}function ov(t,e){t.da.$e(e),Qr(t).X_(e)}function Vu(t){t.da=new Ik({getRemoteKeysForTarget:e=>t.remoteSyncer.getRemoteKeysForTarget(e),At:e=>t.Ea.get(e)||null,ht:()=>t.datastore.serializer.databaseId}),Qr(t).start(),t.Va.ua()}function Du(t){return dr(t)&&!Qr(t).x_()&&t.Ea.size>0}function dr(t){return X(t).Ia.size===0}function av(t){t.da=void 0}async function xx(t){t.Va.set("Online")}async function Vx(t){t.Ea.forEach(((e,n)=>{xu(t,e)}))}async function Dx(t,e){av(t),Du(t)?(t.Va.ha(e),Vu(t)):t.Va.set("Unknown")}async function Mx(t,e,n){if(t.Va.set("Online"),e instanceof q_&&e.state===2&&e.cause)try{await(async function(s,i){const o=i.cause;for(const c of i.targetIds)s.Ea.has(c)&&(await s.remoteSyncer.rejectListen(c,o),s.Ea.delete(c),s.da.removeTarget(c))})(t,e)}catch(r){B(or,"Failed to remove targets %s: %s ",e.targetIds.join(","),r),await Lo(t,r)}else if(e instanceof uo?t.da.Xe(e):e instanceof z_?t.da.st(e):t.da.tt(e),!n.isEqual(Q.min()))try{const r=await nv(t.localStore);n.compareTo(r)>=0&&await(function(i,o){const c=i.da.Tt(o);return c.targetChanges.forEach(((l,u)=>{if(l.resumeToken.approximateByteSize()>0){const h=i.Ea.get(u);h&&i.Ea.set(u,h.withResumeToken(l.resumeToken,o))}})),c.targetMismatches.forEach(((l,u)=>{const h=i.Ea.get(l);if(!h)return;i.Ea.set(l,h.withResumeToken(je.EMPTY_BYTE_STRING,h.snapshotVersion)),ov(i,l);const f=new pn(h.target,l,u,h.sequenceNumber);xu(i,f)})),i.remoteSyncer.applyRemoteEvent(c)})(t,n)}catch(r){B(or,"Failed to raise snapshot:",r),await Lo(t,r)}}async function Lo(t,e,n){if(!Kr(e))throw e;t.Ia.add(1),await fi(t),t.Va.set("Offline"),n||(n=()=>nv(t.localStore)),t.asyncQueue.enqueueRetryable((async()=>{B(or,"Retrying IndexedDB access"),await n(),t.Ia.delete(1),await ya(t)}))}function cv(t,e){return e().catch((n=>Lo(t,n,e)))}async function _a(t){const e=X(t),n=Rn(e);let r=e.Ta.length>0?e.Ta[e.Ta.length-1].batchId:yu;for(;Nx(e);)try{const s=await mx(e.localStore,r);if(s===null){e.Ta.length===0&&n.L_();break}r=s.batchId,Lx(e,s)}catch(s){await Lo(e,s)}lv(e)&&uv(e)}function Nx(t){return dr(t)&&t.Ta.length<10}function Lx(t,e){t.Ta.push(e);const n=Rn(t);n.O_()&&n.Y_&&n.ea(e.mutations)}function lv(t){return dr(t)&&!Rn(t).x_()&&t.Ta.length>0}function uv(t){Rn(t).start()}async function Ox(t){Rn(t).ra()}async function Fx(t){const e=Rn(t);for(const n of t.Ta)e.ea(n.mutations)}async function Ux(t,e,n){const r=t.Ta.shift(),s=Iu.from(r,e,n);await cv(t,(()=>t.remoteSyncer.applySuccessfulWrite(s))),await _a(t)}async function Bx(t,e){e&&Rn(t).Y_&&await(async function(r,s){if((function(o){return wk(o)&&o!==M.ABORTED})(s.code)){const i=r.Ta.shift();Rn(r).B_(),await cv(r,(()=>r.remoteSyncer.rejectFailedWrite(i.batchId,s))),await _a(r)}})(t,e),lv(t)&&uv(t)}async function Lp(t,e){const n=X(t);n.asyncQueue.verifyOperationInProgress(),B(or,"RemoteStore received new credentials");const r=dr(n);n.Ia.add(3),await fi(n),r&&n.Va.set("Unknown"),await n.remoteSyncer.handleCredentialChange(e),n.Ia.delete(3),await ya(n)}async function jx(t,e){const n=X(t);e?(n.Ia.delete(2),await ya(n)):e||(n.Ia.add(2),await fi(n),n.Va.set("Unknown"))}function Qr(t){return t.ma||(t.ma=(function(n,r,s){const i=X(n);return i.sa(),new bx(r,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(t.datastore,t.asyncQueue,{Zo:xx.bind(null,t),Yo:Vx.bind(null,t),t_:Dx.bind(null,t),H_:Mx.bind(null,t)}),t.Ra.push((async e=>{e?(t.ma.B_(),Du(t)?Vu(t):t.Va.set("Unknown")):(await t.ma.stop(),av(t))}))),t.ma}function Rn(t){return t.fa||(t.fa=(function(n,r,s){const i=X(n);return i.sa(),new Ax(r,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(t.datastore,t.asyncQueue,{Zo:()=>Promise.resolve(),Yo:Ox.bind(null,t),t_:Bx.bind(null,t),ta:Fx.bind(null,t),na:Ux.bind(null,t)}),t.Ra.push((async e=>{e?(t.fa.B_(),await _a(t)):(await t.fa.stop(),t.Ta.length>0&&(B(or,`Stopping write stream with ${t.Ta.length} pending writes`),t.Ta=[]))}))),t.fa}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mu{constructor(e,n,r,s,i){this.asyncQueue=e,this.timerId=n,this.targetTimeMs=r,this.op=s,this.removalCallback=i,this.deferred=new $t,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((o=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,n,r,s,i){const o=Date.now()+r,c=new Mu(e,n,o,s,i);return c.start(r),c}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new U(M.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function Nu(t,e){if(Ht("AsyncQueue",`${e}: ${t}`),Kr(t))return new U(M.UNAVAILABLE,`${e}: ${t}`);throw t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sr{static emptySet(e){return new Sr(e.comparator)}constructor(e){this.comparator=e?(n,r)=>e(n,r)||G.comparator(n.key,r.key):(n,r)=>G.comparator(n.key,r.key),this.keyedMap=As(),this.sortedSet=new _e(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const n=this.keyedMap.get(e);return n?this.sortedSet.indexOf(n):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((n,r)=>(e(n),!1)))}add(e){const n=this.delete(e.key);return n.copy(n.keyedMap.insert(e.key,e),n.sortedSet.insert(e,null))}delete(e){const n=this.get(e);return n?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(n)):this}isEqual(e){if(!(e instanceof Sr)||this.size!==e.size)return!1;const n=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;n.hasNext();){const s=n.getNext().key,i=r.getNext().key;if(!s.isEqual(i))return!1}return!0}toString(){const e=[];return this.forEach((n=>{e.push(n.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,n){const r=new Sr;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=n,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Op{constructor(){this.ga=new _e(G.comparator)}track(e){const n=e.doc.key,r=this.ga.get(n);r?e.type!==0&&r.type===3?this.ga=this.ga.insert(n,e):e.type===3&&r.type!==1?this.ga=this.ga.insert(n,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.ga=this.ga.insert(n,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.ga=this.ga.insert(n,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.ga=this.ga.remove(n):e.type===1&&r.type===2?this.ga=this.ga.insert(n,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.ga=this.ga.insert(n,{type:2,doc:e.doc}):K(63341,{Vt:e,pa:r}):this.ga=this.ga.insert(n,e)}ya(){const e=[];return this.ga.inorderTraversal(((n,r)=>{e.push(r)})),e}}class Lr{constructor(e,n,r,s,i,o,c,l,u){this.query=e,this.docs=n,this.oldDocs=r,this.docChanges=s,this.mutatedKeys=i,this.fromCache=o,this.syncStateChanged=c,this.excludesMetadataChanges=l,this.hasCachedResults=u}static fromInitialDocuments(e,n,r,s,i){const o=[];return n.forEach((c=>{o.push({type:0,doc:c})})),new Lr(e,n,Sr.emptySet(n),o,r,s,!0,!1,i)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&ua(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const n=this.docChanges,r=e.docChanges;if(n.length!==r.length)return!1;for(let s=0;s<n.length;s++)if(n[s].type!==r[s].type||!n[s].doc.isEqual(r[s].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $x{constructor(){this.wa=void 0,this.Sa=[]}ba(){return this.Sa.some((e=>e.Da()))}}class zx{constructor(){this.queries=Fp(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(n,r){const s=X(n),i=s.queries;s.queries=Fp(),i.forEach(((o,c)=>{for(const l of c.Sa)l.onError(r)}))})(this,new U(M.ABORTED,"Firestore shutting down"))}}function Fp(){return new hr((t=>P_(t)),ua)}async function Lu(t,e){const n=X(t);let r=3;const s=e.query;let i=n.queries.get(s);i?!i.ba()&&e.Da()&&(r=2):(i=new $x,r=e.Da()?0:1);try{switch(r){case 0:i.wa=await n.onListen(s,!0);break;case 1:i.wa=await n.onListen(s,!1);break;case 2:await n.onFirstRemoteStoreListen(s)}}catch(o){const c=Nu(o,`Initialization of query '${wr(e.query)}' failed`);return void e.onError(c)}n.queries.set(s,i),i.Sa.push(e),e.va(n.onlineState),i.wa&&e.Fa(i.wa)&&Fu(n)}async function Ou(t,e){const n=X(t),r=e.query;let s=3;const i=n.queries.get(r);if(i){const o=i.Sa.indexOf(e);o>=0&&(i.Sa.splice(o,1),i.Sa.length===0?s=e.Da()?0:1:!i.ba()&&e.Da()&&(s=2))}switch(s){case 0:return n.queries.delete(r),n.onUnlisten(r,!0);case 1:return n.queries.delete(r),n.onUnlisten(r,!1);case 2:return n.onLastRemoteStoreUnlisten(r);default:return}}function qx(t,e){const n=X(t);let r=!1;for(const s of e){const i=s.query,o=n.queries.get(i);if(o){for(const c of o.Sa)c.Fa(s)&&(r=!0);o.wa=s}}r&&Fu(n)}function Wx(t,e,n){const r=X(t),s=r.queries.get(e);if(s)for(const i of s.Sa)i.onError(n);r.queries.delete(e)}function Fu(t){t.Ca.forEach((e=>{e.next()}))}var wl,Up;(Up=wl||(wl={})).Ma="default",Up.Cache="cache";class Uu{constructor(e,n,r){this.query=e,this.xa=n,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=r||{}}Fa(e){if(!this.options.includeMetadataChanges){const r=[];for(const s of e.docChanges)s.type!==3&&r.push(s);e=new Lr(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let n=!1;return this.Oa?this.Ba(e)&&(this.xa.next(e),n=!0):this.La(e,this.onlineState)&&(this.ka(e),n=!0),this.Na=e,n}onError(e){this.xa.error(e)}va(e){this.onlineState=e;let n=!1;return this.Na&&!this.Oa&&this.La(this.Na,e)&&(this.ka(this.Na),n=!0),n}La(e,n){if(!e.fromCache||!this.Da())return!0;const r=n!=="Offline";return(!this.options.qa||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||n==="Offline")}Ba(e){if(e.docChanges.length>0)return!0;const n=this.Na&&this.Na.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!n)&&this.options.includeMetadataChanges===!0}ka(e){e=Lr.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Oa=!0,this.xa.next(e)}Da(){return this.options.source!==wl.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hv{constructor(e){this.key=e}}class dv{constructor(e){this.key=e}}class Hx{constructor(e,n){this.query=e,this.Za=n,this.Xa=null,this.hasCachedResults=!1,this.current=!1,this.Ya=ne(),this.mutatedKeys=ne(),this.eu=C_(e),this.tu=new Sr(this.eu)}get nu(){return this.Za}ru(e,n){const r=n?n.iu:new Op,s=n?n.tu:this.tu;let i=n?n.mutatedKeys:this.mutatedKeys,o=s,c=!1;const l=this.query.limitType==="F"&&s.size===this.query.limit?s.last():null,u=this.query.limitType==="L"&&s.size===this.query.limit?s.first():null;if(e.inorderTraversal(((h,f)=>{const m=s.get(h),y=ha(this.query,f)?f:null,w=!!m&&this.mutatedKeys.has(m.key),R=!!y&&(y.hasLocalMutations||this.mutatedKeys.has(y.key)&&y.hasCommittedMutations);let I=!1;m&&y?m.data.isEqual(y.data)?w!==R&&(r.track({type:3,doc:y}),I=!0):this.su(m,y)||(r.track({type:2,doc:y}),I=!0,(l&&this.eu(y,l)>0||u&&this.eu(y,u)<0)&&(c=!0)):!m&&y?(r.track({type:0,doc:y}),I=!0):m&&!y&&(r.track({type:1,doc:m}),I=!0,(l||u)&&(c=!0)),I&&(y?(o=o.add(y),i=R?i.add(h):i.delete(h)):(o=o.delete(h),i=i.delete(h)))})),this.query.limit!==null)for(;o.size>this.query.limit;){const h=this.query.limitType==="F"?o.last():o.first();o=o.delete(h.key),i=i.delete(h.key),r.track({type:1,doc:h})}return{tu:o,iu:r,bs:c,mutatedKeys:i}}su(e,n){return e.hasLocalMutations&&n.hasCommittedMutations&&!n.hasLocalMutations}applyChanges(e,n,r,s){const i=this.tu;this.tu=e.tu,this.mutatedKeys=e.mutatedKeys;const o=e.iu.ya();o.sort(((h,f)=>(function(y,w){const R=I=>{switch(I){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return K(20277,{Vt:I})}};return R(y)-R(w)})(h.type,f.type)||this.eu(h.doc,f.doc))),this.ou(r),s=s??!1;const c=n&&!s?this._u():[],l=this.Ya.size===0&&this.current&&!s?1:0,u=l!==this.Xa;return this.Xa=l,o.length!==0||u?{snapshot:new Lr(this.query,e.tu,i,o,e.mutatedKeys,l===0,u,!1,!!r&&r.resumeToken.approximateByteSize()>0),au:c}:{au:c}}va(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new Op,mutatedKeys:this.mutatedKeys,bs:!1},!1)):{au:[]}}uu(e){return!this.Za.has(e)&&!!this.tu.has(e)&&!this.tu.get(e).hasLocalMutations}ou(e){e&&(e.addedDocuments.forEach((n=>this.Za=this.Za.add(n))),e.modifiedDocuments.forEach((n=>{})),e.removedDocuments.forEach((n=>this.Za=this.Za.delete(n))),this.current=e.current)}_u(){if(!this.current)return[];const e=this.Ya;this.Ya=ne(),this.tu.forEach((r=>{this.uu(r.key)&&(this.Ya=this.Ya.add(r.key))}));const n=[];return e.forEach((r=>{this.Ya.has(r)||n.push(new dv(r))})),this.Ya.forEach((r=>{e.has(r)||n.push(new hv(r))})),n}cu(e){this.Za=e.ks,this.Ya=ne();const n=this.ru(e.documents);return this.applyChanges(n,!0)}lu(){return Lr.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Xa===0,this.hasCachedResults)}}const Bu="SyncEngine";class Gx{constructor(e,n,r){this.query=e,this.targetId=n,this.view=r}}class Kx{constructor(e){this.key=e,this.hu=!1}}class Yx{constructor(e,n,r,s,i,o){this.localStore=e,this.remoteStore=n,this.eventManager=r,this.sharedClientState=s,this.currentUser=i,this.maxConcurrentLimboResolutions=o,this.Pu={},this.Tu=new hr((c=>P_(c)),ua),this.Eu=new Map,this.Iu=new Set,this.Ru=new _e(G.comparator),this.Au=new Map,this.Vu=new Ru,this.du={},this.mu=new Map,this.fu=Nr.ar(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function Qx(t,e,n=!0){const r=_v(t);let s;const i=r.Tu.get(e);return i?(r.sharedClientState.addLocalQueryTarget(i.targetId),s=i.view.lu()):s=await fv(r,e,n,!0),s}async function Xx(t,e){const n=_v(t);await fv(n,e,!0,!1)}async function fv(t,e,n,r){const s=await gx(t.localStore,Pt(e)),i=s.targetId,o=t.sharedClientState.addLocalQueryTarget(i,n);let c;return r&&(c=await Jx(t,e,i,o==="current",s.resumeToken)),t.isPrimaryClient&&n&&iv(t.remoteStore,s),c}async function Jx(t,e,n,r,s){t.pu=(f,m,y)=>(async function(R,I,P,x){let V=I.view.ru(P);V.bs&&(V=await xp(R.localStore,I.query,!1).then((({documents:b})=>I.view.ru(b,V))));const L=x&&x.targetChanges.get(I.targetId),O=x&&x.targetMismatches.get(I.targetId)!=null,z=I.view.applyChanges(V,R.isPrimaryClient,L,O);return jp(R,I.targetId,z.au),z.snapshot})(t,f,m,y);const i=await xp(t.localStore,e,!0),o=new Hx(e,i.ks),c=o.ru(i.documents),l=di.createSynthesizedTargetChangeForCurrentChange(n,r&&t.onlineState!=="Offline",s),u=o.applyChanges(c,t.isPrimaryClient,l);jp(t,n,u.au);const h=new Gx(e,n,o);return t.Tu.set(e,h),t.Eu.has(n)?t.Eu.get(n).push(e):t.Eu.set(n,[e]),u.snapshot}async function Zx(t,e,n){const r=X(t),s=r.Tu.get(e),i=r.Eu.get(s.targetId);if(i.length>1)return r.Eu.set(s.targetId,i.filter((o=>!ua(o,e)))),void r.Tu.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(s.targetId),r.sharedClientState.isActiveQueryTarget(s.targetId)||await _l(r.localStore,s.targetId,!1).then((()=>{r.sharedClientState.clearQueryState(s.targetId),n&&ku(r.remoteStore,s.targetId),Tl(r,s.targetId)})).catch(Gr)):(Tl(r,s.targetId),await _l(r.localStore,s.targetId,!0))}async function eV(t,e){const n=X(t),r=n.Tu.get(e),s=n.Eu.get(r.targetId);n.isPrimaryClient&&s.length===1&&(n.sharedClientState.removeLocalQueryTarget(r.targetId),ku(n.remoteStore,r.targetId))}async function tV(t,e,n){const r=cV(t);try{const s=await(function(o,c){const l=X(o),u=fe.now(),h=c.reduce(((y,w)=>y.add(w.key)),ne());let f,m;return l.persistence.runTransaction("Locally write mutations","readwrite",(y=>{let w=Gt(),R=ne();return l.xs.getEntries(y,h).next((I=>{w=I,w.forEach(((P,x)=>{x.isValidDocument()||(R=R.add(P))}))})).next((()=>l.localDocuments.getOverlayedDocuments(y,w))).next((I=>{f=I;const P=[];for(const x of c){const V=mk(x,f.get(x.key).overlayedDocument);V!=null&&P.push(new Vn(x.key,V,w_(V.value.mapValue),Xe.exists(!0)))}return l.mutationQueue.addMutationBatch(y,u,P,c)})).next((I=>{m=I;const P=I.applyToLocalDocumentSet(f,R);return l.documentOverlayCache.saveOverlays(y,I.batchId,P)}))})).then((()=>({batchId:m.batchId,changes:x_(f)})))})(r.localStore,e);r.sharedClientState.addPendingMutation(s.batchId),(function(o,c,l){let u=o.du[o.currentUser.toKey()];u||(u=new _e(te)),u=u.insert(c,l),o.du[o.currentUser.toKey()]=u})(r,s.batchId,n),await pi(r,s.changes),await _a(r.remoteStore)}catch(s){const i=Nu(s,"Failed to persist write");n.reject(i)}}async function pv(t,e){const n=X(t);try{const r=await fx(n.localStore,e);e.targetChanges.forEach(((s,i)=>{const o=n.Au.get(i);o&&(oe(s.addedDocuments.size+s.modifiedDocuments.size+s.removedDocuments.size<=1,22616),s.addedDocuments.size>0?o.hu=!0:s.modifiedDocuments.size>0?oe(o.hu,14607):s.removedDocuments.size>0&&(oe(o.hu,42227),o.hu=!1))})),await pi(n,r,e)}catch(r){await Gr(r)}}function Bp(t,e,n){const r=X(t);if(r.isPrimaryClient&&n===0||!r.isPrimaryClient&&n===1){const s=[];r.Tu.forEach(((i,o)=>{const c=o.view.va(e);c.snapshot&&s.push(c.snapshot)})),(function(o,c){const l=X(o);l.onlineState=c;let u=!1;l.queries.forEach(((h,f)=>{for(const m of f.Sa)m.va(c)&&(u=!0)})),u&&Fu(l)})(r.eventManager,e),s.length&&r.Pu.H_(s),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function nV(t,e,n){const r=X(t);r.sharedClientState.updateQueryState(e,"rejected",n);const s=r.Au.get(e),i=s&&s.key;if(i){let o=new _e(G.comparator);o=o.insert(i,We.newNoDocument(i,Q.min()));const c=ne().add(i),l=new ma(Q.min(),new Map,new _e(te),o,c);await pv(r,l),r.Ru=r.Ru.remove(i),r.Au.delete(e),ju(r)}else await _l(r.localStore,e,!1).then((()=>Tl(r,e,n))).catch(Gr)}async function rV(t,e){const n=X(t),r=e.batch.batchId;try{const s=await dx(n.localStore,e);gv(n,r,null),mv(n,r),n.sharedClientState.updateMutationState(r,"acknowledged"),await pi(n,s)}catch(s){await Gr(s)}}async function sV(t,e,n){const r=X(t);try{const s=await(function(o,c){const l=X(o);return l.persistence.runTransaction("Reject batch","readwrite-primary",(u=>{let h;return l.mutationQueue.lookupMutationBatch(u,c).next((f=>(oe(f!==null,37113),h=f.keys(),l.mutationQueue.removeMutationBatch(u,f)))).next((()=>l.mutationQueue.performConsistencyCheck(u))).next((()=>l.documentOverlayCache.removeOverlaysForBatchId(u,h,c))).next((()=>l.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(u,h))).next((()=>l.localDocuments.getDocuments(u,h)))}))})(r.localStore,e);gv(r,e,n),mv(r,e),r.sharedClientState.updateMutationState(e,"rejected",n),await pi(r,s)}catch(s){await Gr(s)}}function mv(t,e){(t.mu.get(e)||[]).forEach((n=>{n.resolve()})),t.mu.delete(e)}function gv(t,e,n){const r=X(t);let s=r.du[r.currentUser.toKey()];if(s){const i=s.get(e);i&&(n?i.reject(n):i.resolve(),s=s.remove(e)),r.du[r.currentUser.toKey()]=s}}function Tl(t,e,n=null){t.sharedClientState.removeLocalQueryTarget(e);for(const r of t.Eu.get(e))t.Tu.delete(r),n&&t.Pu.yu(r,n);t.Eu.delete(e),t.isPrimaryClient&&t.Vu.Gr(e).forEach((r=>{t.Vu.containsKey(r)||yv(t,r)}))}function yv(t,e){t.Iu.delete(e.path.canonicalString());const n=t.Ru.get(e);n!==null&&(ku(t.remoteStore,n),t.Ru=t.Ru.remove(e),t.Au.delete(n),ju(t))}function jp(t,e,n){for(const r of n)r instanceof hv?(t.Vu.addReference(r.key,e),iV(t,r)):r instanceof dv?(B(Bu,"Document no longer in limbo: "+r.key),t.Vu.removeReference(r.key,e),t.Vu.containsKey(r.key)||yv(t,r.key)):K(19791,{wu:r})}function iV(t,e){const n=e.key,r=n.path.canonicalString();t.Ru.get(n)||t.Iu.has(r)||(B(Bu,"New document in limbo: "+n),t.Iu.add(r),ju(t))}function ju(t){for(;t.Iu.size>0&&t.Ru.size<t.maxConcurrentLimboResolutions;){const e=t.Iu.values().next().value;t.Iu.delete(e);const n=new G(ue.fromString(e)),r=t.fu.next();t.Au.set(r,new Kx(n)),t.Ru=t.Ru.insert(n,r),iv(t.remoteStore,new pn(Pt(la(n.path)),r,"TargetPurposeLimboResolution",oa.ce))}}async function pi(t,e,n){const r=X(t),s=[],i=[],o=[];r.Tu.isEmpty()||(r.Tu.forEach(((c,l)=>{o.push(r.pu(l,e,n).then((u=>{var h;if((u||n)&&r.isPrimaryClient){const f=u?!u.fromCache:(h=n==null?void 0:n.targetChanges.get(l.targetId))==null?void 0:h.current;r.sharedClientState.updateQueryState(l.targetId,f?"current":"not-current")}if(u){s.push(u);const f=Pu.Is(l.targetId,u);i.push(f)}})))})),await Promise.all(o),r.Pu.H_(s),await(async function(l,u){const h=X(l);try{await h.persistence.runTransaction("notifyLocalViewChanges","readwrite",(f=>N.forEach(u,(m=>N.forEach(m.Ts,(y=>h.persistence.referenceDelegate.addReference(f,m.targetId,y))).next((()=>N.forEach(m.Es,(y=>h.persistence.referenceDelegate.removeReference(f,m.targetId,y)))))))))}catch(f){if(!Kr(f))throw f;B(Cu,"Failed to update sequence numbers: "+f)}for(const f of u){const m=f.targetId;if(!f.fromCache){const y=h.vs.get(m),w=y.snapshotVersion,R=y.withLastLimboFreeSnapshotVersion(w);h.vs=h.vs.insert(m,R)}}})(r.localStore,i))}async function oV(t,e){const n=X(t);if(!n.currentUser.isEqual(e)){B(Bu,"User change. New user:",e.toKey());const r=await tv(n.localStore,e);n.currentUser=e,(function(i,o){i.mu.forEach((c=>{c.forEach((l=>{l.reject(new U(M.CANCELLED,o))}))})),i.mu.clear()})(n,"'waitForPendingWrites' promise is rejected due to a user change."),n.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await pi(n,r.Ns)}}function aV(t,e){const n=X(t),r=n.Au.get(e);if(r&&r.hu)return ne().add(r.key);{let s=ne();const i=n.Eu.get(e);if(!i)return s;for(const o of i){const c=n.Tu.get(o);s=s.unionWith(c.view.nu)}return s}}function _v(t){const e=X(t);return e.remoteStore.remoteSyncer.applyRemoteEvent=pv.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=aV.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=nV.bind(null,e),e.Pu.H_=qx.bind(null,e.eventManager),e.Pu.yu=Wx.bind(null,e.eventManager),e}function cV(t){const e=X(t);return e.remoteStore.remoteSyncer.applySuccessfulWrite=rV.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=sV.bind(null,e),e}class Oo{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=ga(e.databaseInfo.databaseId),this.sharedClientState=this.Du(e),this.persistence=this.Cu(e),await this.persistence.start(),this.localStore=this.vu(e),this.gcScheduler=this.Fu(e,this.localStore),this.indexBackfillerScheduler=this.Mu(e,this.localStore)}Fu(e,n){return null}Mu(e,n){return null}vu(e){return hx(this.persistence,new cx,e.initialUser,this.serializer)}Cu(e){return new ev(Su.Vi,this.serializer)}Du(e){return new _x}async terminate(){var e,n;(e=this.gcScheduler)==null||e.stop(),(n=this.indexBackfillerScheduler)==null||n.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Oo.provider={build:()=>new Oo};class lV extends Oo{constructor(e){super(),this.cacheSizeBytes=e}Fu(e,n){oe(this.persistence.referenceDelegate instanceof No,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new Gk(r,e.asyncQueue,n)}Cu(e){const n=this.cacheSizeBytes!==void 0?Je.withCacheSize(this.cacheSizeBytes):Je.DEFAULT;return new ev((r=>No.Vi(r,n)),this.serializer)}}class El{async initialize(e,n){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(n),this.remoteStore=this.createRemoteStore(n),this.eventManager=this.createEventManager(n),this.syncEngine=this.createSyncEngine(n,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Bp(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=oV.bind(null,this.syncEngine),await jx(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new zx})()}createDatastore(e){const n=ga(e.databaseInfo.databaseId),r=Ix(e.databaseInfo);return Px(e.authCredentials,e.appCheckCredentials,r,n)}createRemoteStore(e){return(function(r,s,i,o,c){return new kx(r,s,i,o,c)})(this.localStore,this.datastore,e.asyncQueue,(n=>Bp(this.syncEngine,n,0)),(function(){return Mp.v()?new Mp:new vx})())}createSyncEngine(e,n){return(function(s,i,o,c,l,u,h){const f=new Yx(s,i,o,c,l,u);return h&&(f.gu=!0),f})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,n)}async terminate(){var e,n;await(async function(s){const i=X(s);B(or,"RemoteStore shutting down."),i.Ia.add(5),await fi(i),i.Aa.shutdown(),i.Va.set("Unknown")})(this.remoteStore),(e=this.datastore)==null||e.terminate(),(n=this.eventManager)==null||n.terminate()}}El.provider={build:()=>new El};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $u{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ou(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ou(this.observer.error,e):Ht("Uncaught Error in snapshot listener:",e.toString()))}Nu(){this.muted=!0}Ou(e,n){setTimeout((()=>{this.muted||e(n)}),0)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Sn="FirestoreClient";class uV{constructor(e,n,r,s,i){this.authCredentials=e,this.appCheckCredentials=n,this.asyncQueue=r,this._databaseInfo=s,this.user=qe.UNAUTHENTICATED,this.clientId=gu.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=i,this.authCredentials.start(r,(async o=>{B(Sn,"Received user=",o.uid),await this.authCredentialListener(o),this.user=o})),this.appCheckCredentials.start(r,(o=>(B(Sn,"Received new app check token=",o),this.appCheckCredentialListener(o,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new $t;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(n){const r=Nu(n,"Failed to shutdown persistence");e.reject(r)}})),e.promise}}async function Ic(t,e){t.asyncQueue.verifyOperationInProgress(),B(Sn,"Initializing OfflineComponentProvider");const n=t.configuration;await e.initialize(n);let r=n.initialUser;t.setCredentialChangeListener((async s=>{r.isEqual(s)||(await tv(e.localStore,s),r=s)})),e.persistence.setDatabaseDeletedListener((()=>t.terminate())),t._offlineComponents=e}async function $p(t,e){t.asyncQueue.verifyOperationInProgress();const n=await hV(t);B(Sn,"Initializing OnlineComponentProvider"),await e.initialize(n,t.configuration),t.setCredentialChangeListener((r=>Lp(e.remoteStore,r))),t.setAppCheckTokenChangeListener(((r,s)=>Lp(e.remoteStore,s))),t._onlineComponents=e}async function hV(t){if(!t._offlineComponents)if(t._uninitializedComponentsProvider){B(Sn,"Using user provided OfflineComponentProvider");try{await Ic(t,t._uninitializedComponentsProvider._offline)}catch(e){const n=e;if(!(function(s){return s.name==="FirebaseError"?s.code===M.FAILED_PRECONDITION||s.code===M.UNIMPLEMENTED:!(typeof DOMException<"u"&&s instanceof DOMException)||s.code===22||s.code===20||s.code===11})(n))throw n;ir("Error using user provided cache. Falling back to memory cache: "+n),await Ic(t,new Oo)}}else B(Sn,"Using default OfflineComponentProvider"),await Ic(t,new lV(void 0));return t._offlineComponents}async function vv(t){return t._onlineComponents||(t._uninitializedComponentsProvider?(B(Sn,"Using user provided OnlineComponentProvider"),await $p(t,t._uninitializedComponentsProvider._online)):(B(Sn,"Using default OnlineComponentProvider"),await $p(t,new El))),t._onlineComponents}function dV(t){return vv(t).then((e=>e.syncEngine))}async function Fo(t){const e=await vv(t),n=e.eventManager;return n.onListen=Qx.bind(null,e.syncEngine),n.onUnlisten=Zx.bind(null,e.syncEngine),n.onFirstRemoteStoreListen=Xx.bind(null,e.syncEngine),n.onLastRemoteStoreUnlisten=eV.bind(null,e.syncEngine),n}function fV(t,e,n,r){const s=new $u(r),i=new Uu(e,s,n);return t.asyncQueue.enqueueAndForget((async()=>Lu(await Fo(t),i))),()=>{s.Nu(),t.asyncQueue.enqueueAndForget((async()=>Ou(await Fo(t),i)))}}function wv(t,e,n={}){const r=new $t;return t.asyncQueue.enqueueAndForget((async()=>(function(i,o,c,l,u){const h=new $u({next:m=>{h.Nu(),o.enqueueAndForget((()=>Ou(i,f)));const y=m.docs.has(c);!y&&m.fromCache?u.reject(new U(M.UNAVAILABLE,"Failed to get document because the client is offline.")):y&&m.fromCache&&l&&l.source==="server"?u.reject(new U(M.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):u.resolve(m)},error:m=>u.reject(m)}),f=new Uu(la(c.path),h,{includeMetadataChanges:!0,qa:!0});return Lu(i,f)})(await Fo(t),t.asyncQueue,e,n,r))),r.promise}function pV(t,e,n={}){const r=new $t;return t.asyncQueue.enqueueAndForget((async()=>(function(i,o,c,l,u){const h=new $u({next:m=>{h.Nu(),o.enqueueAndForget((()=>Ou(i,f))),m.fromCache&&l.source==="server"?u.reject(new U(M.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):u.resolve(m)},error:m=>u.reject(m)}),f=new Uu(c,h,{includeMetadataChanges:!0,qa:!0});return Lu(i,f)})(await Fo(t),t.asyncQueue,e,n,r))),r.promise}function mV(t,e){const n=new $t;return t.asyncQueue.enqueueAndForget((async()=>tV(await dV(t),e,n))),n.promise}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Tv(t){const e={};return t.timeoutSeconds!==void 0&&(e.timeoutSeconds=t.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gV="ComponentProvider",zp=new Map;function yV(t,e,n,r,s){return new F1(t,e,n,s.host,s.ssl,s.experimentalForceLongPolling,s.experimentalAutoDetectLongPolling,Tv(s.experimentalLongPollingOptions),s.useFetchStreams,s.isUsingEmulator,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ev="firestore.googleapis.com",qp=!0;class Wp{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new U(M.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=Ev,this.ssl=qp}else this.host=e.host,this.ssl=e.ssl??qp;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=Z_;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<Wk)throw new U(M.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}S1("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Tv(e.experimentalLongPollingOptions??{}),(function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new U(M.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new U(M.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new U(M.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(r,s){return r.timeoutSeconds===s.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class va{constructor(e,n,r,s){this._authCredentials=e,this._appCheckCredentials=n,this._databaseId=r,this._app=s,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Wp({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new U(M.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new U(M.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Wp(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new y1;switch(r.type){case"firstParty":return new T1(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new U(M.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(n){const r=zp.get(n);r&&(B(gV,"Removing Datastore"),zp.delete(n),r.terminate())})(this),Promise.resolve()}}function _V(t,e,n,r={}){var u;t=Be(t,va);const s=ur(e),i=t._getSettings(),o={...i,emulatorOptions:t._getEmulatorOptions()},c=`${e}:${n}`;s&&hu(`https://${c}`),i.host!==Ev&&i.host!==c&&ir("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const l={...i,host:c,ssl:s,emulatorOptions:r};if(!nr(l,o)&&(t._setSettings(l),r.mockUserToken)){let h,f;if(typeof r.mockUserToken=="string")h=r.mockUserToken,f=qe.MOCK_USER;else{h=qP(r.mockUserToken,(u=t._app)==null?void 0:u.options.projectId);const m=r.mockUserToken.sub||r.mockUserToken.user_id;if(!m)throw new U(M.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");f=new qe(m)}t._authCredentials=new _1(new c_(h,f))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Dn{constructor(e,n,r){this.converter=n,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new Dn(this.firestore,e,this._query)}}class ye{constructor(e,n,r){this.converter=n,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new _n(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new ye(this.firestore,e,this._key)}toJSON(){return{type:ye._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,n,r){if(ui(n,ye._jsonSchema))return new ye(e,r||null,new G(ue.fromString(n.referencePath)))}}ye._jsonSchemaVersion="firestore/documentReference/1.0",ye._jsonSchema={type:Se("string",ye._jsonSchemaVersion),referencePath:Se("string")};class _n extends Dn{constructor(e,n,r){super(e,n,la(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new ye(this.firestore,null,new G(e))}withConverter(e){return new _n(this.firestore,e,this._path)}}function lN(t,e,...n){if(t=ge(t),l_("collection","path",e),t instanceof va){const r=ue.fromString(e,...n);return sp(r),new _n(t,null,r)}{if(!(t instanceof ye||t instanceof _n))throw new U(M.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=t._path.child(ue.fromString(e,...n));return sp(r),new _n(t.firestore,null,r)}}function vV(t,e,...n){if(t=ge(t),arguments.length===1&&(e=gu.newId()),l_("doc","path",e),t instanceof va){const r=ue.fromString(e,...n);return rp(r),new ye(t,null,new G(r))}{if(!(t instanceof ye||t instanceof _n))throw new U(M.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=t._path.child(ue.fromString(e,...n));return rp(r),new ye(t.firestore,t instanceof _n?t.converter:null,new G(r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hp="AsyncQueue";class Gp{constructor(e=Promise.resolve()){this.Yu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new rv(this,"async_queue_retry"),this._c=()=>{const r=Ec();r&&B(Hp,"Visibility state changed to "+r.visibilityState),this.M_.w_()},this.ac=e;const n=Ec();n&&typeof n.addEventListener=="function"&&n.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.uc(),this.cc(e)}enterRestrictedMode(e){if(!this.ec){this.ec=!0,this.sc=e||!1;const n=Ec();n&&typeof n.removeEventListener=="function"&&n.removeEventListener("visibilitychange",this._c)}}enqueue(e){if(this.uc(),this.ec)return new Promise((()=>{}));const n=new $t;return this.cc((()=>this.ec&&this.sc?Promise.resolve():(e().then(n.resolve,n.reject),n.promise))).then((()=>n.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.Yu.push(e),this.lc())))}async lc(){if(this.Yu.length!==0){try{await this.Yu[0](),this.Yu.shift(),this.M_.reset()}catch(e){if(!Kr(e))throw e;B(Hp,"Operation failed with retryable error: "+e)}this.Yu.length>0&&this.M_.p_((()=>this.lc()))}}cc(e){const n=this.ac.then((()=>(this.rc=!0,e().catch((r=>{throw this.nc=r,this.rc=!1,Ht("INTERNAL UNHANDLED ERROR: ",Kp(r)),r})).then((r=>(this.rc=!1,r))))));return this.ac=n,n}enqueueAfterDelay(e,n,r){this.uc(),this.oc.indexOf(e)>-1&&(n=0);const s=Mu.createAndSchedule(this,e,n,r,(i=>this.hc(i)));return this.tc.push(s),s}uc(){this.nc&&K(47125,{Pc:Kp(this.nc)})}verifyOperationInProgress(){}async Tc(){let e;do e=this.ac,await e;while(e!==this.ac)}Ec(e){for(const n of this.tc)if(n.timerId===e)return!0;return!1}Ic(e){return this.Tc().then((()=>{this.tc.sort(((n,r)=>n.targetTimeMs-r.targetTimeMs));for(const n of this.tc)if(n.skipDelay(),e!=="all"&&n.timerId===e)break;return this.Tc()}))}Rc(e){this.oc.push(e)}hc(e){const n=this.tc.indexOf(e);this.tc.splice(n,1)}}function Kp(t){let e=t.message||"";return t.stack&&(e=t.stack.includes(t.message)?t.stack:t.message+`
`+t.stack),e}class vt extends va{constructor(e,n,r,s){super(e,n,r,s),this.type="firestore",this._queue=new Gp,this._persistenceKey=(s==null?void 0:s.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new Gp(e),this._firestoreClient=void 0,await e}}}function uN(t,e){const n=typeof t=="object"?t:pu(),r=typeof t=="string"?t:xo,s=sa(n,"firestore").getImmediate({identifier:r});if(!s._initialized){const i=Ky("firestore");i&&_V(s,...i)}return s}function Xr(t){if(t._terminated)throw new U(M.FAILED_PRECONDITION,"The client has already been terminated.");return t._firestoreClient||wV(t),t._firestoreClient}function wV(t){var r,s,i,o;const e=t._freezeSettings(),n=yV(t._databaseId,((r=t._app)==null?void 0:r.options.appId)||"",t._persistenceKey,(s=t._app)==null?void 0:s.options.apiKey,e);t._componentsProvider||(i=e.localCache)!=null&&i._offlineComponentProvider&&((o=e.localCache)!=null&&o._onlineComponentProvider)&&(t._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),t._firestoreClient=new uV(t._authCredentials,t._appCheckCredentials,t._queue,n,t._componentsProvider&&(function(l){const u=l==null?void 0:l._online.build();return{_offline:l==null?void 0:l._offline.build(u),_online:u}})(t._componentsProvider))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class at{constructor(e){this._byteString=e}static fromBase64String(e){try{return new at(je.fromBase64String(e))}catch(n){throw new U(M.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+n)}}static fromUint8Array(e){return new at(je.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:at._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(ui(e,at._jsonSchema))return at.fromBase64String(e.bytes)}}at._jsonSchemaVersion="firestore/bytes/1.0",at._jsonSchema={type:Se("string",at._jsonSchemaVersion),bytes:Se("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wa{constructor(...e){for(let n=0;n<e.length;++n)if(e[n].length===0)throw new U(M.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Ue(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mi{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kt{constructor(e,n){if(!isFinite(e)||e<-90||e>90)throw new U(M.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(n)||n<-180||n>180)throw new U(M.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+n);this._lat=e,this._long=n}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return te(this._lat,e._lat)||te(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:kt._jsonSchemaVersion}}static fromJSON(e){if(ui(e,kt._jsonSchema))return new kt(e.latitude,e.longitude)}}kt._jsonSchemaVersion="firestore/geoPoint/1.0",kt._jsonSchema={type:Se("string",kt._jsonSchemaVersion),latitude:Se("number"),longitude:Se("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mt{constructor(e){this._values=(e||[]).map((n=>n))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(r,s){if(r.length!==s.length)return!1;for(let i=0;i<r.length;++i)if(r[i]!==s[i])return!1;return!0})(this._values,e._values)}toJSON(){return{type:mt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(ui(e,mt._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every((n=>typeof n=="number")))return new mt(e.vectorValues);throw new U(M.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}mt._jsonSchemaVersion="firestore/vectorValue/1.0",mt._jsonSchema={type:Se("string",mt._jsonSchemaVersion),vectorValues:Se("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const TV=/^__.*__$/;class EV{constructor(e,n,r){this.data=e,this.fieldMask=n,this.fieldTransforms=r}toMutation(e,n){return this.fieldMask!==null?new Vn(e,this.data,this.fieldMask,n,this.fieldTransforms):new hi(e,this.data,n,this.fieldTransforms)}}class Iv{constructor(e,n,r){this.data=e,this.fieldMask=n,this.fieldTransforms=r}toMutation(e,n){return new Vn(e,this.data,this.fieldMask,n,this.fieldTransforms)}}function bv(t){switch(t){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw K(40011,{dataSource:t})}}class zu{constructor(e,n,r,s,i,o){this.settings=e,this.databaseId=n,this.serializer=r,this.ignoreUndefinedProperties=s,i===void 0&&this.Ac(),this.fieldTransforms=i||[],this.fieldMask=o||[]}get path(){return this.settings.path}get dataSource(){return this.settings.dataSource}i(e){return new zu({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}dc(e){var s;const n=(s=this.path)==null?void 0:s.child(e),r=this.i({path:n,arrayElement:!1});return r.mc(e),r}fc(e){var s;const n=(s=this.path)==null?void 0:s.child(e),r=this.i({path:n,arrayElement:!1});return r.Ac(),r}gc(e){return this.i({path:void 0,arrayElement:!0})}yc(e){return Uo(e,this.settings.methodName,this.settings.hasConverter||!1,this.path,this.settings.targetDoc)}contains(e){return this.fieldMask.find((n=>e.isPrefixOf(n)))!==void 0||this.fieldTransforms.find((n=>e.isPrefixOf(n.field)))!==void 0}Ac(){if(this.path)for(let e=0;e<this.path.length;e++)this.mc(this.path.get(e))}mc(e){if(e.length===0)throw this.yc("Document fields must not be empty");if(bv(this.dataSource)&&TV.test(e))throw this.yc('Document fields cannot begin and end with "__"')}}class IV{constructor(e,n,r){this.databaseId=e,this.ignoreUndefinedProperties=n,this.serializer=r||ga(e)}A(e,n,r,s=!1){return new zu({dataSource:e,methodName:n,targetDoc:r,path:Ue.emptyPath(),arrayElement:!1,hasConverter:s},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function gi(t){const e=t._freezeSettings(),n=ga(t._databaseId);return new IV(t._databaseId,!!e.ignoreUndefinedProperties,n)}function qu(t,e,n,r,s,i={}){const o=t.A(i.merge||i.mergeFields?2:0,e,n,s);Gu("Data must be an object, but it was:",o,r);const c=Sv(r,o);let l,u;if(i.merge)l=new rt(o.fieldMask),u=o.fieldTransforms;else if(i.mergeFields){const h=[];for(const f of i.mergeFields){const m=ar(e,f,n);if(!o.contains(m))throw new U(M.INVALID_ARGUMENT,`Field '${m}' is specified in your field mask but missing from your input data.`);kv(h,m)||h.push(m)}l=new rt(h),u=o.fieldTransforms.filter((f=>l.covers(f.field)))}else l=null,u=o.fieldTransforms;return new EV(new Ze(c),l,u)}class Ta extends mi{_toFieldTransform(e){if(e.dataSource!==2)throw e.dataSource===1?e.yc(`${this._methodName}() can only appear at the top level of your update data`):e.yc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof Ta}}class Wu extends mi{_toFieldTransform(e){return new U_(e.path,new Xs)}isEqual(e){return e instanceof Wu}}class Hu extends mi{constructor(e,n){super(e),this.bc=n}_toFieldTransform(e){const n=new ei(e.serializer,M_(e.serializer,this.bc));return new U_(e.path,n)}isEqual(e){return e instanceof Hu&&this.bc===e.bc}}function Av(t,e,n,r){const s=t.A(1,e,n);Gu("Data must be an object, but it was:",s,r);const i=[],o=Ze.empty();xn(r,((l,u)=>{const h=Cv(e,l,n);u=ge(u);const f=s.fc(h);if(u instanceof Ta)i.push(h);else{const m=yi(u,f);m!=null&&(i.push(h),o.set(h,m))}}));const c=new rt(i);return new Iv(o,c,s.fieldTransforms)}function Rv(t,e,n,r,s,i){const o=t.A(1,e,n),c=[ar(e,r,n)],l=[s];if(i.length%2!=0)throw new U(M.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let m=0;m<i.length;m+=2)c.push(ar(e,i[m])),l.push(i[m+1]);const u=[],h=Ze.empty();for(let m=c.length-1;m>=0;--m)if(!kv(u,c[m])){const y=c[m];let w=l[m];w=ge(w);const R=o.fc(y);if(w instanceof Ta)u.push(y);else{const I=yi(w,R);I!=null&&(u.push(y),h.set(y,I))}}const f=new rt(u);return new Iv(h,f,o.fieldTransforms)}function bV(t,e,n,r=!1){return yi(n,t.A(r?4:3,e))}function yi(t,e){if(Pv(t=ge(t)))return Gu("Unsupported field value:",e,t),Sv(t,e);if(t instanceof mi)return(function(r,s){if(!bv(s.dataSource))throw s.yc(`${r._methodName}() can only be used with update() and set()`);if(!s.path)throw s.yc(`${r._methodName}() is not currently supported inside arrays`);const i=r._toFieldTransform(s);i&&s.fieldTransforms.push(i)})(t,e),null;if(t===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),t instanceof Array){if(e.settings.arrayElement&&e.dataSource!==4)throw e.yc("Nested arrays are not supported");return(function(r,s){const i=[];let o=0;for(const c of r){let l=yi(c,s.gc(o));l==null&&(l={nullValue:"NULL_VALUE"}),i.push(l),o++}return{arrayValue:{values:i}}})(t,e)}return(function(r,s){if((r=ge(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return M_(s.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const i=fe.fromDate(r);return{timestampValue:Mo(s.serializer,i)}}if(r instanceof fe){const i=new fe(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Mo(s.serializer,i)}}if(r instanceof kt)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof at)return{bytesValue:W_(s.serializer,r._byteString)};if(r instanceof ye){const i=s.databaseId,o=r.firestore._databaseId;if(!o.isEqual(i))throw s.yc(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${i.projectId}/${i.database}`);return{referenceValue:Au(r.firestore._databaseId||s.databaseId,r._key.path)}}if(r instanceof mt)return(function(o,c){const l=o instanceof mt?o.toArray():o;return{mapValue:{fields:{[__]:{stringValue:v_},[Vo]:{arrayValue:{values:l.map((h=>{if(typeof h!="number")throw c.yc("VectorValues must only contain numeric values.");return Eu(c.serializer,h)}))}}}}}})(r,s);if(J_(r))return r._toProto(s.serializer);throw s.yc(`Unsupported field value: ${ia(r)}`)})(t,e)}function Sv(t,e){const n={};return d_(t)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):xn(t,((r,s)=>{const i=yi(s,e.dc(r));i!=null&&(n[r]=i)})),{mapValue:{fields:n}}}function Pv(t){return!(typeof t!="object"||t===null||t instanceof Array||t instanceof Date||t instanceof fe||t instanceof kt||t instanceof at||t instanceof ye||t instanceof mi||t instanceof mt||J_(t))}function Gu(t,e,n){if(!Pv(n)||!u_(n)){const r=ia(n);throw r==="an object"?e.yc(t+" a custom object"):e.yc(t+" "+r)}}function ar(t,e,n){if((e=ge(e))instanceof wa)return e._internalPath;if(typeof e=="string")return Cv(t,e);throw Uo("Field path arguments must be of type string or ",t,!1,void 0,n)}const AV=new RegExp("[~\\*/\\[\\]]");function Cv(t,e,n){if(e.search(AV)>=0)throw Uo(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,t,!1,void 0,n);try{return new wa(...e.split("."))._internalPath}catch{throw Uo(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,t,!1,void 0,n)}}function Uo(t,e,n,r,s){const i=r&&!r.isEmpty(),o=s!==void 0;let c=`Function ${e}() called with invalid data`;n&&(c+=" (via `toFirestore()`)"),c+=". ";let l="";return(i||o)&&(l+=" (found",i&&(l+=` in field ${r}`),o&&(l+=` in document ${s}`),l+=")"),new U(M.INVALID_ARGUMENT,c+t+l)}function kv(t,e){return t.some((n=>n.isEqual(e)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RV{convertValue(e,n="none"){switch(An(e)){case 0:return null;case 1:return e.booleanValue;case 2:return Ie(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,n);case 5:return e.stringValue;case 6:return this.convertBytes(bn(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,n);case 11:return this.convertObject(e.mapValue,n);case 10:return this.convertVectorValue(e.mapValue);default:throw K(62114,{value:e})}}convertObject(e,n){return this.convertObjectMap(e.fields,n)}convertObjectMap(e,n="none"){const r={};return xn(e,((s,i)=>{r[s]=this.convertValue(i,n)})),r}convertVectorValue(e){var r,s,i;const n=(i=(s=(r=e.fields)==null?void 0:r[Vo].arrayValue)==null?void 0:s.values)==null?void 0:i.map((o=>Ie(o.doubleValue)));return new mt(n)}convertGeoPoint(e){return new kt(Ie(e.latitude),Ie(e.longitude))}convertArray(e,n){return(e.values||[]).map((r=>this.convertValue(r,n)))}convertServerTimestamp(e,n){switch(n){case"previous":const r=ca(e);return r==null?null:this.convertValue(r,n);case"estimate":return this.convertTimestamp(Gs(e));default:return null}}convertTimestamp(e){const n=In(e);return new fe(n.seconds,n.nanos)}convertDocumentKey(e,n){const r=ue.fromString(e);oe(X_(r),9688,{name:e});const s=new Ks(r.get(1),r.get(3)),i=new G(r.popFirst(5));return s.isEqual(n)||Ht(`Document ${i} contains a document reference within a different database (${s.projectId}/${s.database}) which is not supported. It will be treated as a reference in the current database (${n.projectId}/${n.database}) instead.`),i}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ku extends RV{constructor(e){super(),this.firestore=e}convertBytes(e){return new at(e)}convertReference(e){const n=this.convertDocumentKey(e,this.firestore._databaseId);return new ye(this.firestore,null,n)}}function hN(){return new Wu("serverTimestamp")}function dN(t){return new Hu("increment",t)}const Yp="@firebase/firestore",Qp="4.13.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xp(t){return(function(n,r){if(typeof n!="object"||n===null)return!1;const s=n;for(const i of r)if(i in s&&typeof s[i]=="function")return!0;return!1})(t,["next","error","complete"])}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xv{constructor(e,n,r,s,i){this._firestore=e,this._userDataWriter=n,this._key=r,this._document=s,this._converter=i}get id(){return this._key.path.lastSegment()}get ref(){return new ye(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new SV(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){var e;return((e=this._document)==null?void 0:e.data.clone().value.mapValue.fields)??void 0}get(e){if(this._document){const n=this._document.data.field(ar("DocumentSnapshot.get",e));if(n!==null)return this._userDataWriter.convertValue(n)}}}class SV extends xv{data(){return super.data()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vv(t){if(t.limitType==="L"&&t.explicitOrderBy.length===0)throw new U(M.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Yu{}class Dv extends Yu{}function fN(t,e,...n){let r=[];e instanceof Yu&&r.push(e),r=r.concat(n),(function(i){const o=i.filter((l=>l instanceof Qu)).length,c=i.filter((l=>l instanceof Ea)).length;if(o>1||o>0&&c>0)throw new U(M.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(const s of r)t=s._apply(t);return t}class Ea extends Dv{constructor(e,n,r){super(),this._field=e,this._op=n,this._value=r,this.type="where"}static _create(e,n,r){return new Ea(e,n,r)}_apply(e){const n=this._parse(e);return Mv(e._query,n),new Dn(e.firestore,e.converter,dl(e._query,n))}_parse(e){const n=gi(e.firestore);return(function(i,o,c,l,u,h,f){let m;if(u.isKeyField()){if(h==="array-contains"||h==="array-contains-any")throw new U(M.INVALID_ARGUMENT,`Invalid Query. You can't perform '${h}' queries on documentId().`);if(h==="in"||h==="not-in"){Zp(f,h);const w=[];for(const R of f)w.push(Jp(l,i,R));m={arrayValue:{values:w}}}else m=Jp(l,i,f)}else h!=="in"&&h!=="not-in"&&h!=="array-contains-any"||Zp(f,h),m=bV(c,o,f,h==="in"||h==="not-in");return Re.create(u,h,m)})(e._query,"where",n,e.firestore._databaseId,this._field,this._op,this._value)}}function pN(t,e,n){const r=e,s=ar("where",t);return Ea._create(s,r,n)}class Qu extends Yu{constructor(e,n){super(),this.type=e,this._queryConstraints=n}static _create(e,n){return new Qu(e,n)}_parse(e){const n=this._queryConstraints.map((r=>r._parse(e))).filter((r=>r.getFilters().length>0));return n.length===1?n[0]:_t.create(n,this._getOperator())}_apply(e){const n=this._parse(e);return n.getFilters().length===0?e:((function(s,i){let o=s;const c=i.getFlattenedFilters();for(const l of c)Mv(o,l),o=dl(o,l)})(e._query,n),new Dn(e.firestore,e.converter,dl(e._query,n)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Xu extends Dv{constructor(e,n){super(),this._field=e,this._direction=n,this.type="orderBy"}static _create(e,n){return new Xu(e,n)}_apply(e){const n=(function(s,i,o){if(s.startAt!==null)throw new U(M.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(s.endAt!==null)throw new U(M.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new Qs(i,o)})(e._query,this._field,this._direction);return new Dn(e.firestore,e.converter,nk(e._query,n))}}function mN(t,e="asc"){const n=e,r=ar("orderBy",t);return Xu._create(r,n)}function Jp(t,e,n){if(typeof(n=ge(n))=="string"){if(n==="")throw new U(M.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!S_(e)&&n.indexOf("/")!==-1)throw new U(M.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${n}' contains a '/' character.`);const r=e.path.child(ue.fromString(n));if(!G.isDocumentKey(r))throw new U(M.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return dp(t,new G(r))}if(n instanceof ye)return dp(t,n._key);throw new U(M.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${ia(n)}.`)}function Zp(t,e){if(!Array.isArray(t)||t.length===0)throw new U(M.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Mv(t,e){const n=(function(s,i){for(const o of s)for(const c of o.getFlattenedFilters())if(i.indexOf(c.op)>=0)return c.op;return null})(t.filters,(function(s){switch(s){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(n!==null)throw n===e.op?new U(M.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new U(M.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${n.toString()}' filters.`)}function Ju(t,e,n){let r;return r=t?n&&(n.merge||n.mergeFields)?t.toFirestore(e,n):t.toFirestore(e):e,r}class Ss{constructor(e,n){this.hasPendingWrites=e,this.fromCache=n}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class Zn extends xv{constructor(e,n,r,s,i,o){super(e,n,r,s,o),this._firestore=e,this._firestoreImpl=e,this.metadata=i}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const n=new ho(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(n,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,n={}){if(this._document){const r=this._document.data.field(ar("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,n.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new U(M.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,n={};return n.type=Zn._jsonSchemaVersion,n.bundle="",n.bundleSource="DocumentSnapshot",n.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?n:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),n.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),n)}}Zn._jsonSchemaVersion="firestore/documentSnapshot/1.0",Zn._jsonSchema={type:Se("string",Zn._jsonSchemaVersion),bundleSource:Se("string","DocumentSnapshot"),bundleName:Se("string"),bundle:Se("string")};class ho extends Zn{data(e={}){return super.data(e)}}class er{constructor(e,n,r,s){this._firestore=e,this._userDataWriter=n,this._snapshot=s,this.metadata=new Ss(s.hasPendingWrites,s.fromCache),this.query=r}get docs(){const e=[];return this.forEach((n=>e.push(n))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,n){this._snapshot.docs.forEach((r=>{e.call(n,new ho(this._firestore,this._userDataWriter,r.key,r,new Ss(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){const n=!!e.includeMetadataChanges;if(n&&this._snapshot.excludesMetadataChanges)throw new U(M.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===n||(this._cachedChanges=(function(s,i){if(s._snapshot.oldDocs.isEmpty()){let o=0;return s._snapshot.docChanges.map((c=>{const l=new ho(s._firestore,s._userDataWriter,c.doc.key,c.doc,new Ss(s._snapshot.mutatedKeys.has(c.doc.key),s._snapshot.fromCache),s.query.converter);return c.doc,{type:"added",doc:l,oldIndex:-1,newIndex:o++}}))}{let o=s._snapshot.oldDocs;return s._snapshot.docChanges.filter((c=>i||c.type!==3)).map((c=>{const l=new ho(s._firestore,s._userDataWriter,c.doc.key,c.doc,new Ss(s._snapshot.mutatedKeys.has(c.doc.key),s._snapshot.fromCache),s.query.converter);let u=-1,h=-1;return c.type!==0&&(u=o.indexOf(c.doc.key),o=o.delete(c.doc.key)),c.type!==1&&(o=o.add(c.doc),h=o.indexOf(c.doc.key)),{type:PV(c.type),doc:l,oldIndex:u,newIndex:h}}))}})(this,n),this._cachedChangesIncludeMetadataChanges=n),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new U(M.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=er._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=gu.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const n=[],r=[],s=[];return this.docs.forEach((i=>{i._document!==null&&(n.push(i._document),r.push(this._userDataWriter.convertObjectMap(i._document.data.value.mapValue.fields,"previous")),s.push(i.ref.path))})),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}}function PV(t){switch(t){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return K(61501,{type:t})}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */er._jsonSchemaVersion="firestore/querySnapshot/1.0",er._jsonSchema={type:Se("string",er._jsonSchemaVersion),bundleSource:Se("string","QuerySnapshot"),bundleName:Se("string"),bundle:Se("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class CV{constructor(e,n){this._firestore=e,this._commitHandler=n,this._mutations=[],this._committed=!1,this._dataReader=gi(e)}set(e,n,r){this._verifyNotCommitted();const s=bc(e,this._firestore),i=Ju(s.converter,n,r),o=qu(this._dataReader,"WriteBatch.set",s._key,i,s.converter!==null,r);return this._mutations.push(o.toMutation(s._key,Xe.none())),this}update(e,n,r,...s){this._verifyNotCommitted();const i=bc(e,this._firestore);let o;return o=typeof(n=ge(n))=="string"||n instanceof wa?Rv(this._dataReader,"WriteBatch.update",i._key,n,r,s):Av(this._dataReader,"WriteBatch.update",i._key,n),this._mutations.push(o.toMutation(i._key,Xe.exists(!0))),this}delete(e){this._verifyNotCommitted();const n=bc(e,this._firestore);return this._mutations=this._mutations.concat(new pa(n._key,Xe.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new U(M.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}}function bc(t,e){if((t=ge(t)).firestore!==e)throw new U(M.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gN(t){t=Be(t,ye);const e=Be(t.firestore,vt),n=Xr(e);return wv(n,t._key).then((r=>Zu(e,t,r)))}function yN(t){t=Be(t,ye);const e=Be(t.firestore,vt),n=Xr(e);return wv(n,t._key,{source:"server"}).then((r=>Zu(e,t,r)))}function _N(t){t=Be(t,Dn);const e=Be(t.firestore,vt),n=Xr(e),r=new Ku(e);return Vv(t._query),pV(n,t._query).then((s=>new er(e,r,t,s)))}function vN(t,e,n){t=Be(t,ye);const r=Be(t.firestore,vt),s=Ju(t.converter,e,n),i=gi(r);return _i(r,[qu(i,"setDoc",t._key,s,t.converter!==null,n).toMutation(t._key,Xe.none())])}function wN(t,e,n,...r){t=Be(t,ye);const s=Be(t.firestore,vt),i=gi(s);let o;return o=typeof(e=ge(e))=="string"||e instanceof wa?Rv(i,"updateDoc",t._key,e,n,r):Av(i,"updateDoc",t._key,e),_i(s,[o.toMutation(t._key,Xe.exists(!0))])}function TN(t){return _i(Be(t.firestore,vt),[new pa(t._key,Xe.none())])}function EN(t,e){const n=Be(t.firestore,vt),r=vV(t),s=Ju(t.converter,e),i=gi(t.firestore);return _i(n,[qu(i,"addDoc",r._key,s,t.converter!==null,{}).toMutation(r._key,Xe.exists(!1))]).then((()=>r))}function IN(t,...e){var u,h,f;t=ge(t);let n={includeMetadataChanges:!1,source:"default"},r=0;typeof e[r]!="object"||Xp(e[r])||(n=e[r++]);const s={includeMetadataChanges:n.includeMetadataChanges,source:n.source};if(Xp(e[r])){const m=e[r];e[r]=(u=m.next)==null?void 0:u.bind(m),e[r+1]=(h=m.error)==null?void 0:h.bind(m),e[r+2]=(f=m.complete)==null?void 0:f.bind(m)}let i,o,c;if(t instanceof ye)o=Be(t.firestore,vt),c=la(t._key.path),i={next:m=>{e[r]&&e[r](Zu(o,t,m))},error:e[r+1],complete:e[r+2]};else{const m=Be(t,Dn);o=Be(m.firestore,vt),c=m._query;const y=new Ku(o);i={next:w=>{e[r]&&e[r](new er(o,y,m,w))},error:e[r+1],complete:e[r+2]},Vv(t._query)}const l=Xr(o);return fV(l,c,s,i)}function _i(t,e){const n=Xr(t);return mV(n,e)}function Zu(t,e,n){const r=n.docs.get(e._key),s=new Ku(t);return new Zn(t,s,e._key,r,new Ss(n.hasPendingWrites,n.fromCache),e.converter)}function bN(t){return t=Be(t,vt),Xr(t),new CV(t,(e=>_i(t,e)))}(function(e,n=!0){g1(Wr),rr(new Tn("firestore",((r,{instanceIdentifier:s,options:i})=>{const o=r.getProvider("app").getImmediate(),c=new vt(new v1(r.getProvider("auth-internal")),new E1(o,r.getProvider("app-check-internal")),U1(o,s),o);return i={useFetchStreams:n,...i},c._setSettings(i),c}),"PUBLIC").setMultipleInstances(!0)),jt(Yp,Qp,e),jt(Yp,Qp,"esm2020")})();function Nv(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const kV=Nv,Lv=new ci("auth","Firebase",Nv());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bo=new du("@firebase/auth");function xV(t,...e){Bo.logLevel<=ee.WARN&&Bo.warn(`Auth (${Wr}): ${t}`,...e)}function fo(t,...e){Bo.logLevel<=ee.ERROR&&Bo.error(`Auth (${Wr}): ${t}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Mt(t,...e){throw th(t,...e)}function gt(t,...e){return th(t,...e)}function eh(t,e,n){const r={...kV(),[e]:n};return new ci("auth","Firebase",r).create(e,{appName:t.name})}function vn(t){return eh(t,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function Ov(t,e,n){const r=n;if(!(e instanceof r))throw r.name!==e.constructor.name&&Mt(t,"argument-error"),eh(t,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function th(t,...e){if(typeof t!="string"){const n=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=t.name),t._errorFactory.create(n,...r)}return Lv.create(t,...e)}function Y(t,e,...n){if(!t)throw th(e,...n)}function Ut(t){const e="INTERNAL ASSERTION FAILED: "+t;throw fo(e),new Error(e)}function Kt(t,e){t||Ut(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Il(){var t;return typeof self<"u"&&((t=self.location)==null?void 0:t.href)||""}function VV(){return em()==="http:"||em()==="https:"}function em(){var t;return typeof self<"u"&&((t=self.location)==null?void 0:t.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function DV(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(VV()||KP()||"connection"in navigator)?navigator.onLine:!0}function MV(){if(typeof navigator>"u")return null;const t=navigator;return t.languages&&t.languages[0]||t.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vi{constructor(e,n){this.shortDelay=e,this.longDelay=n,Kt(n>e,"Short delay should be less than long delay!"),this.isMobile=WP()||YP()}get(){return DV()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nh(t,e){Kt(t.emulator,"Emulator should always be set here");const{url:n}=t.emulator;return e?`${n}${e.startsWith("/")?e.slice(1):e}`:n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fv{static initialize(e,n,r){this.fetchImpl=e,n&&(this.headersImpl=n),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;Ut("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;Ut("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;Ut("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const NV={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const LV=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],OV=new vi(3e4,6e4);function rh(t,e){return t.tenantId&&!e.tenantId?{...e,tenantId:t.tenantId}:e}async function Jr(t,e,n,r,s={}){return Uv(t,s,async()=>{let i={},o={};r&&(e==="GET"?o=r:i={body:JSON.stringify(r)});const c=li({key:t.config.apiKey,...o}).slice(1),l=await t._getAdditionalHeaders();l["Content-Type"]="application/json",t.languageCode&&(l["X-Firebase-Locale"]=t.languageCode);const u={method:e,headers:l,...i};return GP()||(u.referrerPolicy="no-referrer"),t.emulatorConfig&&ur(t.emulatorConfig.host)&&(u.credentials="include"),Fv.fetch()(await Bv(t,t.config.apiHost,n,c),u)})}async function Uv(t,e,n){t._canInitEmulator=!1;const r={...NV,...e};try{const s=new UV(t),i=await Promise.race([n(),s.promise]);s.clearNetworkTimeout();const o=await i.json();if("needConfirmation"in o)throw Yi(t,"account-exists-with-different-credential",o);if(i.ok&&!("errorMessage"in o))return o;{const c=i.ok?o.errorMessage:o.error.message,[l,u]=c.split(" : ");if(l==="FEDERATED_USER_ID_ALREADY_LINKED")throw Yi(t,"credential-already-in-use",o);if(l==="EMAIL_EXISTS")throw Yi(t,"email-already-in-use",o);if(l==="USER_DISABLED")throw Yi(t,"user-disabled",o);const h=r[l]||l.toLowerCase().replace(/[_\s]+/g,"-");if(u)throw eh(t,h,u);Mt(t,h)}}catch(s){if(s instanceof Ot)throw s;Mt(t,"network-request-failed",{message:String(s)})}}async function FV(t,e,n,r,s={}){const i=await Jr(t,e,n,r,s);return"mfaPendingCredential"in i&&Mt(t,"multi-factor-auth-required",{_serverResponse:i}),i}async function Bv(t,e,n,r){const s=`${e}${n}?${r}`,i=t,o=i.config.emulator?nh(t.config,s):`${t.config.apiScheme}://${s}`;return LV.includes(n)&&(await i._persistenceManagerAvailable,i._getPersistenceType()==="COOKIE")?i._getPersistence()._getFinalTarget(o).toString():o}class UV{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((n,r)=>{this.timer=setTimeout(()=>r(gt(this.auth,"network-request-failed")),OV.get())})}}function Yi(t,e,n){const r={appName:t.name};n.email&&(r.email=n.email),n.phoneNumber&&(r.phoneNumber=n.phoneNumber);const s=gt(t,e,r);return s.customData._tokenResponse=n,s}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function BV(t,e){return Jr(t,"POST","/v1/accounts:delete",e)}async function jo(t,e){return Jr(t,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Us(t){if(t)try{const e=new Date(Number(t));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function jV(t,e=!1){const n=ge(t),r=await n.getIdToken(e),s=sh(r);Y(s&&s.exp&&s.auth_time&&s.iat,n.auth,"internal-error");const i=typeof s.firebase=="object"?s.firebase:void 0,o=i==null?void 0:i.sign_in_provider;return{claims:s,token:r,authTime:Us(Ac(s.auth_time)),issuedAtTime:Us(Ac(s.iat)),expirationTime:Us(Ac(s.exp)),signInProvider:o||null,signInSecondFactor:(i==null?void 0:i.sign_in_second_factor)||null}}function Ac(t){return Number(t)*1e3}function sh(t){const[e,n,r]=t.split(".");if(e===void 0||n===void 0||r===void 0)return fo("JWT malformed, contained fewer than 3 sections"),null;try{const s=Hy(n);return s?JSON.parse(s):(fo("Failed to decode base64 JWT payload"),null)}catch(s){return fo("Caught error parsing JWT payload as JSON",s==null?void 0:s.toString()),null}}function tm(t){const e=sh(t);return Y(e,"internal-error"),Y(typeof e.exp<"u","internal-error"),Y(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ti(t,e,n=!1){if(n)return e;try{return await e}catch(r){throw r instanceof Ot&&$V(r)&&t.auth.currentUser===t&&await t.auth.signOut(),r}}function $V({code:t}){return t==="auth/user-disabled"||t==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zV{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){if(e){const n=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),n}else{this.errorBackoff=3e4;const r=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,r)}}schedule(e=!1){if(!this.isRunning)return;const n=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},n)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bl{constructor(e,n){this.createdAt=e,this.lastLoginAt=n,this._initializeTime()}_initializeTime(){this.lastSignInTime=Us(this.lastLoginAt),this.creationTime=Us(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function $o(t){var f;const e=t.auth,n=await t.getIdToken(),r=await ti(t,jo(e,{idToken:n}));Y(r==null?void 0:r.users.length,e,"internal-error");const s=r.users[0];t._notifyReloadListener(s);const i=(f=s.providerUserInfo)!=null&&f.length?jv(s.providerUserInfo):[],o=WV(t.providerData,i),c=t.isAnonymous,l=!(t.email&&s.passwordHash)&&!(o!=null&&o.length),u=c?l:!1,h={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:o,metadata:new bl(s.createdAt,s.lastLoginAt),isAnonymous:u};Object.assign(t,h)}async function qV(t){const e=ge(t);await $o(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function WV(t,e){return[...t.filter(r=>!e.some(s=>s.providerId===r.providerId)),...e]}function jv(t){return t.map(({providerId:e,...n})=>({providerId:e,uid:n.rawId||"",displayName:n.displayName||null,email:n.email||null,phoneNumber:n.phoneNumber||null,photoURL:n.photoUrl||null}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function HV(t,e){const n=await Uv(t,{},async()=>{const r=li({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:s,apiKey:i}=t.config,o=await Bv(t,s,"/v1/token",`key=${i}`),c=await t._getAdditionalHeaders();c["Content-Type"]="application/x-www-form-urlencoded";const l={method:"POST",headers:c,body:r};return t.emulatorConfig&&ur(t.emulatorConfig.host)&&(l.credentials="include"),Fv.fetch()(o,l)});return{accessToken:n.access_token,expiresIn:n.expires_in,refreshToken:n.refresh_token}}async function GV(t,e){return Jr(t,"POST","/v2/accounts:revokeToken",rh(t,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pr{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){Y(e.idToken,"internal-error"),Y(typeof e.idToken<"u","internal-error"),Y(typeof e.refreshToken<"u","internal-error");const n="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):tm(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,n)}updateFromIdToken(e){Y(e.length!==0,"internal-error");const n=tm(e);this.updateTokensAndExpiration(e,null,n)}async getToken(e,n=!1){return!n&&this.accessToken&&!this.isExpired?this.accessToken:(Y(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,n){const{accessToken:r,refreshToken:s,expiresIn:i}=await HV(e,n);this.updateTokensAndExpiration(r,s,Number(i))}updateTokensAndExpiration(e,n,r){this.refreshToken=n||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,n){const{refreshToken:r,accessToken:s,expirationTime:i}=n,o=new Pr;return r&&(Y(typeof r=="string","internal-error",{appName:e}),o.refreshToken=r),s&&(Y(typeof s=="string","internal-error",{appName:e}),o.accessToken=s),i&&(Y(typeof i=="number","internal-error",{appName:e}),o.expirationTime=i),o}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Pr,this.toJSON())}_performRefresh(){return Ut("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function on(t,e){Y(typeof t=="string"||typeof t>"u","internal-error",{appName:e})}class ft{constructor({uid:e,auth:n,stsTokenManager:r,...s}){this.providerId="firebase",this.proactiveRefresh=new zV(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=e,this.auth=n,this.stsTokenManager=r,this.accessToken=r.accessToken,this.displayName=s.displayName||null,this.email=s.email||null,this.emailVerified=s.emailVerified||!1,this.phoneNumber=s.phoneNumber||null,this.photoURL=s.photoURL||null,this.isAnonymous=s.isAnonymous||!1,this.tenantId=s.tenantId||null,this.providerData=s.providerData?[...s.providerData]:[],this.metadata=new bl(s.createdAt||void 0,s.lastLoginAt||void 0)}async getIdToken(e){const n=await ti(this,this.stsTokenManager.getToken(this.auth,e));return Y(n,this.auth,"internal-error"),this.accessToken!==n&&(this.accessToken=n,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),n}getIdTokenResult(e){return jV(this,e)}reload(){return qV(this)}_assign(e){this!==e&&(Y(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(n=>({...n})),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const n=new ft({...this,auth:e,stsTokenManager:this.stsTokenManager._clone()});return n.metadata._copy(this.metadata),n}_onReload(e){Y(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,n=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),n&&await $o(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(nt(this.auth.app))return Promise.reject(vn(this.auth));const e=await this.getIdToken();return await ti(this,BV(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return{uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>({...e})),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId,...this.metadata.toJSON(),apiKey:this.auth.config.apiKey,appName:this.auth.name}}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,n){const r=n.displayName??void 0,s=n.email??void 0,i=n.phoneNumber??void 0,o=n.photoURL??void 0,c=n.tenantId??void 0,l=n._redirectEventId??void 0,u=n.createdAt??void 0,h=n.lastLoginAt??void 0,{uid:f,emailVerified:m,isAnonymous:y,providerData:w,stsTokenManager:R}=n;Y(f&&R,e,"internal-error");const I=Pr.fromJSON(this.name,R);Y(typeof f=="string",e,"internal-error"),on(r,e.name),on(s,e.name),Y(typeof m=="boolean",e,"internal-error"),Y(typeof y=="boolean",e,"internal-error"),on(i,e.name),on(o,e.name),on(c,e.name),on(l,e.name),on(u,e.name),on(h,e.name);const P=new ft({uid:f,auth:e,email:s,emailVerified:m,displayName:r,isAnonymous:y,photoURL:o,phoneNumber:i,tenantId:c,stsTokenManager:I,createdAt:u,lastLoginAt:h});return w&&Array.isArray(w)&&(P.providerData=w.map(x=>({...x}))),l&&(P._redirectEventId=l),P}static async _fromIdTokenResponse(e,n,r=!1){const s=new Pr;s.updateFromServerResponse(n);const i=new ft({uid:n.localId,auth:e,stsTokenManager:s,isAnonymous:r});return await $o(i),i}static async _fromGetAccountInfoResponse(e,n,r){const s=n.users[0];Y(s.localId!==void 0,"internal-error");const i=s.providerUserInfo!==void 0?jv(s.providerUserInfo):[],o=!(s.email&&s.passwordHash)&&!(i!=null&&i.length),c=new Pr;c.updateFromIdToken(r);const l=new ft({uid:s.localId,auth:e,stsTokenManager:c,isAnonymous:o}),u={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:i,metadata:new bl(s.createdAt,s.lastLoginAt),isAnonymous:!(s.email&&s.passwordHash)&&!(i!=null&&i.length)};return Object.assign(l,u),l}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nm=new Map;function Bt(t){Kt(t instanceof Function,"Expected a class definition");let e=nm.get(t);return e?(Kt(e instanceof t,"Instance stored in cache mismatched with class"),e):(e=new t,nm.set(t,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $v{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,n){this.storage[e]=n}async _get(e){const n=this.storage[e];return n===void 0?null:n}async _remove(e){delete this.storage[e]}_addListener(e,n){}_removeListener(e,n){}}$v.type="NONE";const rm=$v;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function po(t,e,n){return`firebase:${t}:${e}:${n}`}class Cr{constructor(e,n,r){this.persistence=e,this.auth=n,this.userKey=r;const{config:s,name:i}=this.auth;this.fullUserKey=po(this.userKey,s.apiKey,i),this.fullPersistenceKey=po("persistence",s.apiKey,i),this.boundEventHandler=n._onStorageEvent.bind(n),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const n=await jo(this.auth,{idToken:e}).catch(()=>{});return n?ft._fromGetAccountInfoResponse(this.auth,n,e):null}return ft._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const n=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,n)return this.setCurrentUser(n)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,n,r="authUser"){if(!n.length)return new Cr(Bt(rm),e,r);const s=(await Promise.all(n.map(async u=>{if(await u._isAvailable())return u}))).filter(u=>u);let i=s[0]||Bt(rm);const o=po(r,e.config.apiKey,e.name);let c=null;for(const u of n)try{const h=await u._get(o);if(h){let f;if(typeof h=="string"){const m=await jo(e,{idToken:h}).catch(()=>{});if(!m)break;f=await ft._fromGetAccountInfoResponse(e,m,h)}else f=ft._fromJSON(e,h);u!==i&&(c=f),i=u;break}}catch{}const l=s.filter(u=>u._shouldAllowMigration);return!i._shouldAllowMigration||!l.length?new Cr(i,e,r):(i=l[0],c&&await i._set(o,c.toJSON()),await Promise.all(n.map(async u=>{if(u!==i)try{await u._remove(o)}catch{}})),new Cr(i,e,r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sm(t){const e=t.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(Hv(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(zv(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(Kv(e))return"Blackberry";if(Yv(e))return"Webos";if(qv(e))return"Safari";if((e.includes("chrome/")||Wv(e))&&!e.includes("edge/"))return"Chrome";if(Gv(e))return"Android";{const n=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=t.match(n);if((r==null?void 0:r.length)===2)return r[1]}return"Other"}function zv(t=He()){return/firefox\//i.test(t)}function qv(t=He()){const e=t.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function Wv(t=He()){return/crios\//i.test(t)}function Hv(t=He()){return/iemobile/i.test(t)}function Gv(t=He()){return/android/i.test(t)}function Kv(t=He()){return/blackberry/i.test(t)}function Yv(t=He()){return/webos/i.test(t)}function ih(t=He()){return/iphone|ipad|ipod/i.test(t)||/macintosh/i.test(t)&&/mobile/i.test(t)}function KV(t=He()){var e;return ih(t)&&!!((e=window.navigator)!=null&&e.standalone)}function YV(){return QP()&&document.documentMode===10}function Qv(t=He()){return ih(t)||Gv(t)||Yv(t)||Kv(t)||/windows phone/i.test(t)||Hv(t)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xv(t,e=[]){let n;switch(t){case"Browser":n=sm(He());break;case"Worker":n=`${sm(He())}-${t}`;break;default:n=t}const r=e.length?e.join(","):"FirebaseCore-web";return`${n}/JsCore/${Wr}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class QV{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,n){const r=i=>new Promise((o,c)=>{try{const l=e(i);o(l)}catch(l){c(l)}});r.onAbort=n,this.queue.push(r);const s=this.queue.length-1;return()=>{this.queue[s]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const n=[];try{for(const r of this.queue)await r(e),r.onAbort&&n.push(r.onAbort)}catch(r){n.reverse();for(const s of n)try{s()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r==null?void 0:r.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function XV(t,e={}){return Jr(t,"GET","/v2/passwordPolicy",rh(t,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const JV=6;class ZV{constructor(e){var r;const n=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=n.minPasswordLength??JV,n.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=n.maxPasswordLength),n.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=n.containsLowercaseCharacter),n.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=n.containsUppercaseCharacter),n.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=n.containsNumericCharacter),n.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=n.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=((r=e.allowedNonAlphanumericCharacters)==null?void 0:r.join(""))??"",this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const n={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,n),this.validatePasswordCharacterOptions(e,n),n.isValid&&(n.isValid=n.meetsMinPasswordLength??!0),n.isValid&&(n.isValid=n.meetsMaxPasswordLength??!0),n.isValid&&(n.isValid=n.containsLowercaseLetter??!0),n.isValid&&(n.isValid=n.containsUppercaseLetter??!0),n.isValid&&(n.isValid=n.containsNumericCharacter??!0),n.isValid&&(n.isValid=n.containsNonAlphanumericCharacter??!0),n}validatePasswordLengthOptions(e,n){const r=this.customStrengthOptions.minPasswordLength,s=this.customStrengthOptions.maxPasswordLength;r&&(n.meetsMinPasswordLength=e.length>=r),s&&(n.meetsMaxPasswordLength=e.length<=s)}validatePasswordCharacterOptions(e,n){this.updatePasswordCharacterOptionsStatuses(n,!1,!1,!1,!1);let r;for(let s=0;s<e.length;s++)r=e.charAt(s),this.updatePasswordCharacterOptionsStatuses(n,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,n,r,s,i){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=n)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=s)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=i))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eD{constructor(e,n,r,s){this.app=e,this.heartbeatServiceProvider=n,this.appCheckServiceProvider=r,this.config=s,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new im(this),this.idTokenSubscription=new im(this),this.beforeStateQueue=new QV(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=Lv,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=s.sdkClientVersion,this._persistenceManagerAvailable=new Promise(i=>this._resolvePersistenceManagerAvailable=i)}_initializeWithPersistence(e,n){return n&&(this._popupRedirectResolver=Bt(n)),this._initializationPromise=this.queue(async()=>{var r,s,i;if(!this._deleted&&(this.persistenceManager=await Cr.create(this,e),(r=this._resolvePersistenceManagerAvailable)==null||r.call(this),!this._deleted)){if((s=this._popupRedirectResolver)!=null&&s._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(n),this.lastNotifiedUid=((i=this.currentUser)==null?void 0:i.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const n=await jo(this,{idToken:e}),r=await ft._fromGetAccountInfoResponse(this,n,e);await this.directlySetCurrentUser(r)}catch(n){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",n),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var i;if(nt(this.app)){const o=this.app.settings.authIdToken;return o?new Promise(c=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(o).then(c,c))}):this.directlySetCurrentUser(null)}const n=await this.assertedPersistence.getCurrentUser();let r=n,s=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const o=(i=this.redirectUser)==null?void 0:i._redirectEventId,c=r==null?void 0:r._redirectEventId,l=await this.tryRedirectSignIn(e);(!o||o===c)&&(l!=null&&l.user)&&(r=l.user,s=!0)}if(!r)return this.directlySetCurrentUser(null);if(!r._redirectEventId){if(s)try{await this.beforeStateQueue.runMiddleware(r)}catch(o){r=n,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(o))}return r?this.reloadAndSetCurrentUserOrClear(r):this.directlySetCurrentUser(null)}return Y(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===r._redirectEventId?this.directlySetCurrentUser(r):this.reloadAndSetCurrentUserOrClear(r)}async tryRedirectSignIn(e){let n=null;try{n=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return n}async reloadAndSetCurrentUserOrClear(e){try{await $o(e)}catch(n){if((n==null?void 0:n.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=MV()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(nt(this.app))return Promise.reject(vn(this));const n=e?ge(e):null;return n&&Y(n.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(n&&n._clone(this))}async _updateCurrentUser(e,n=!1){if(!this._deleted)return e&&Y(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),n||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return nt(this.app)?Promise.reject(vn(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return nt(this.app)?Promise.reject(vn(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(Bt(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const n=this._getPasswordPolicyInternal();return n.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):n.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await XV(this),n=new ZV(e);this.tenantId===null?this._projectPasswordPolicy=n:this._tenantPasswordPolicies[this.tenantId]=n}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new ci("auth","Firebase",e())}onAuthStateChanged(e,n,r){return this.registerStateListener(this.authStateSubscription,e,n,r)}beforeAuthStateChanged(e,n){return this.beforeStateQueue.pushCallback(e,n)}onIdTokenChanged(e,n,r){return this.registerStateListener(this.idTokenSubscription,e,n,r)}authStateReady(){return new Promise((e,n)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},n)}})}async revokeAccessToken(e){if(this.currentUser){const n=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:n};this.tenantId!=null&&(r.tenantId=this.tenantId),await GV(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)==null?void 0:e.toJSON()}}async _setRedirectUser(e,n){const r=await this.getOrInitRedirectPersistenceManager(n);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const n=e&&Bt(e)||this._popupRedirectResolver;Y(n,this,"argument-error"),this.redirectPersistenceManager=await Cr.create(this,[Bt(n._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var n,r;return this._isInitialized&&await this.queue(async()=>{}),((n=this._currentUser)==null?void 0:n._redirectEventId)===e?this._currentUser:((r=this.redirectUser)==null?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var n;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=((n=this.currentUser)==null?void 0:n.uid)??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,n,r,s){if(this._deleted)return()=>{};const i=typeof n=="function"?n:n.next.bind(n);let o=!1;const c=this._isInitialized?Promise.resolve():this._initializationPromise;if(Y(c,this,"internal-error"),c.then(()=>{o||i(this.currentUser)}),typeof n=="function"){const l=e.addObserver(n,r,s);return()=>{o=!0,l()}}else{const l=e.addObserver(n);return()=>{o=!0,l()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return Y(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=Xv(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var s;const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const n=await((s=this.heartbeatServiceProvider.getImmediate({optional:!0}))==null?void 0:s.getHeartbeatsHeader());n&&(e["X-Firebase-Client"]=n);const r=await this._getAppCheckToken();return r&&(e["X-Firebase-AppCheck"]=r),e}async _getAppCheckToken(){var n;if(nt(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await((n=this.appCheckServiceProvider.getImmediate({optional:!0}))==null?void 0:n.getToken());return e!=null&&e.error&&xV(`Error while retrieving App Check token: ${e.error}`),e==null?void 0:e.token}}function Zr(t){return ge(t)}class im{constructor(e){this.auth=e,this.observer=null,this.addObserver=sC(n=>this.observer=n)}get next(){return Y(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let oh={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function tD(t){oh=t}function nD(t){return oh.loadJS(t)}function rD(){return oh.gapiScript}function sD(t){return`__${t}${Math.floor(Math.random()*1e6)}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function iD(t,e){const n=sa(t,"auth");if(n.isInitialized()){const s=n.getImmediate(),i=n.getOptions();if(nr(i,e??{}))return s;Mt(s,"already-initialized")}return n.initialize({options:e})}function oD(t,e){const n=(e==null?void 0:e.persistence)||[],r=(Array.isArray(n)?n:[n]).map(Bt);e!=null&&e.errorMap&&t._updateErrorMap(e.errorMap),t._initializeWithPersistence(r,e==null?void 0:e.popupRedirectResolver)}function aD(t,e,n){const r=Zr(t);Y(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const s=!1,i=Jv(e),{host:o,port:c}=cD(e),l=c===null?"":`:${c}`,u={url:`${i}//${o}${l}/`},h=Object.freeze({host:o,port:c,protocol:i.replace(":",""),options:Object.freeze({disableWarnings:s})});if(!r._canInitEmulator){Y(r.config.emulator&&r.emulatorConfig,r,"emulator-config-failed"),Y(nr(u,r.config.emulator)&&nr(h,r.emulatorConfig),r,"emulator-config-failed");return}r.config.emulator=u,r.emulatorConfig=h,r.settings.appVerificationDisabledForTesting=!0,ur(o)?hu(`${i}//${o}${l}`):lD()}function Jv(t){const e=t.indexOf(":");return e<0?"":t.substr(0,e+1)}function cD(t){const e=Jv(t),n=/(\/\/)?([^?#/]+)/.exec(t.substr(e.length));if(!n)return{host:"",port:null};const r=n[2].split("@").pop()||"",s=/^(\[[^\]]+\])(:|$)/.exec(r);if(s){const i=s[1];return{host:i,port:om(r.substr(i.length+1))}}else{const[i,o]=r.split(":");return{host:i,port:om(o)}}}function om(t){if(!t)return null;const e=Number(t);return isNaN(e)?null:e}function lD(){function t(){const e=document.createElement("p"),n=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",n.position="fixed",n.width="100%",n.backgroundColor="#ffffff",n.border=".1em solid #000000",n.color="#b50000",n.bottom="0px",n.left="0px",n.margin="0px",n.zIndex="10000",n.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",t):t())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zv{constructor(e,n){this.providerId=e,this.signInMethod=n}toJSON(){return Ut("not implemented")}_getIdTokenResponse(e){return Ut("not implemented")}_linkToIdToken(e,n){return Ut("not implemented")}_getReauthenticationResolver(e){return Ut("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function kr(t,e){return FV(t,"POST","/v1/accounts:signInWithIdp",rh(t,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const uD="http://localhost";class cr extends Zv{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const n=new cr(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(n.idToken=e.idToken),e.accessToken&&(n.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(n.nonce=e.nonce),e.pendingToken&&(n.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(n.accessToken=e.oauthToken,n.secret=e.oauthTokenSecret):Mt("argument-error"),n}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const n=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:s,...i}=n;if(!r||!s)return null;const o=new cr(r,s);return o.idToken=i.idToken||void 0,o.accessToken=i.accessToken||void 0,o.secret=i.secret,o.nonce=i.nonce,o.pendingToken=i.pendingToken||null,o}_getIdTokenResponse(e){const n=this.buildRequest();return kr(e,n)}_linkToIdToken(e,n){const r=this.buildRequest();return r.idToken=n,kr(e,r)}_getReauthenticationResolver(e){const n=this.buildRequest();return n.autoCreate=!1,kr(e,n)}buildRequest(){const e={requestUri:uD,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const n={};this.idToken&&(n.id_token=this.idToken),this.accessToken&&(n.access_token=this.accessToken),this.secret&&(n.oauth_token_secret=this.secret),n.providerId=this.providerId,this.nonce&&!this.pendingToken&&(n.nonce=this.nonce),e.postBody=li(n)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ia{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wi extends Ia{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ln extends wi{constructor(){super("facebook.com")}static credential(e){return cr._fromParams({providerId:ln.PROVIDER_ID,signInMethod:ln.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return ln.credentialFromTaggedObject(e)}static credentialFromError(e){return ln.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return ln.credential(e.oauthAccessToken)}catch{return null}}}ln.FACEBOOK_SIGN_IN_METHOD="facebook.com";ln.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class un extends wi{constructor(){super("google.com"),this.addScope("profile")}static credential(e,n){return cr._fromParams({providerId:un.PROVIDER_ID,signInMethod:un.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:n})}static credentialFromResult(e){return un.credentialFromTaggedObject(e)}static credentialFromError(e){return un.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:n,oauthAccessToken:r}=e;if(!n&&!r)return null;try{return un.credential(n,r)}catch{return null}}}un.GOOGLE_SIGN_IN_METHOD="google.com";un.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hn extends wi{constructor(){super("github.com")}static credential(e){return cr._fromParams({providerId:hn.PROVIDER_ID,signInMethod:hn.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return hn.credentialFromTaggedObject(e)}static credentialFromError(e){return hn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return hn.credential(e.oauthAccessToken)}catch{return null}}}hn.GITHUB_SIGN_IN_METHOD="github.com";hn.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dn extends wi{constructor(){super("twitter.com")}static credential(e,n){return cr._fromParams({providerId:dn.PROVIDER_ID,signInMethod:dn.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:n})}static credentialFromResult(e){return dn.credentialFromTaggedObject(e)}static credentialFromError(e){return dn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:n,oauthTokenSecret:r}=e;if(!n||!r)return null;try{return dn.credential(n,r)}catch{return null}}}dn.TWITTER_SIGN_IN_METHOD="twitter.com";dn.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Or{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,n,r,s=!1){const i=await ft._fromIdTokenResponse(e,r,s),o=am(r);return new Or({user:i,providerId:o,_tokenResponse:r,operationType:n})}static async _forOperation(e,n,r){await e._updateTokensIfNecessary(r,!0);const s=am(r);return new Or({user:e,providerId:s,_tokenResponse:r,operationType:n})}}function am(t){return t.providerId?t.providerId:"phoneNumber"in t?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zo extends Ot{constructor(e,n,r,s){super(n.code,n.message),this.operationType=r,this.user=s,Object.setPrototypeOf(this,zo.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:n.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,n,r,s){return new zo(e,n,r,s)}}function ew(t,e,n,r){return(e==="reauthenticate"?n._getReauthenticationResolver(t):n._getIdTokenResponse(t)).catch(i=>{throw i.code==="auth/multi-factor-auth-required"?zo._fromErrorAndOperation(t,i,e,r):i})}async function hD(t,e,n=!1){const r=await ti(t,e._linkToIdToken(t.auth,await t.getIdToken()),n);return Or._forOperation(t,"link",r)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function dD(t,e,n=!1){const{auth:r}=t;if(nt(r.app))return Promise.reject(vn(r));const s="reauthenticate";try{const i=await ti(t,ew(r,s,e,t),n);Y(i.idToken,r,"internal-error");const o=sh(i.idToken);Y(o,r,"internal-error");const{sub:c}=o;return Y(t.uid===c,r,"user-mismatch"),Or._forOperation(t,s,i)}catch(i){throw(i==null?void 0:i.code)==="auth/user-not-found"&&Mt(r,"user-mismatch"),i}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fD(t,e,n=!1){if(nt(t.app))return Promise.reject(vn(t));const r="signIn",s=await ew(t,r,e),i=await Or._fromIdTokenResponse(t,r,s);return n||await t._updateCurrentUser(i.user),i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function AN(t,e){return ge(t).setPersistence(e)}function pD(t,e,n,r){return ge(t).onIdTokenChanged(e,n,r)}function mD(t,e,n){return ge(t).beforeAuthStateChanged(e,n)}function RN(t,e,n,r){return ge(t).onAuthStateChanged(e,n,r)}function SN(t){return ge(t).signOut()}const qo="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tw{constructor(e,n){this.storageRetriever=e,this.type=n}_isAvailable(){try{return this.storage?(this.storage.setItem(qo,"1"),this.storage.removeItem(qo),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,n){return this.storage.setItem(e,JSON.stringify(n)),Promise.resolve()}_get(e){const n=this.storage.getItem(e);return Promise.resolve(n?JSON.parse(n):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gD=1e3,yD=10;class nw extends tw{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,n)=>this.onStorageEvent(e,n),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=Qv(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const n of Object.keys(this.listeners)){const r=this.storage.getItem(n),s=this.localCache[n];r!==s&&e(n,s,r)}}onStorageEvent(e,n=!1){if(!e.key){this.forAllChangedKeys((o,c,l)=>{this.notifyListeners(o,l)});return}const r=e.key;n?this.detachListener():this.stopPolling();const s=()=>{const o=this.storage.getItem(r);!n&&this.localCache[r]===o||this.notifyListeners(r,o)},i=this.storage.getItem(r);YV()&&i!==e.newValue&&e.newValue!==e.oldValue?setTimeout(s,yD):s()}notifyListeners(e,n){this.localCache[e]=n;const r=this.listeners[e];if(r)for(const s of Array.from(r))s(n&&JSON.parse(n))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,n,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:n,newValue:r}),!0)})},gD)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,n){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(n)}_removeListener(e,n){this.listeners[e]&&(this.listeners[e].delete(n),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,n){await super._set(e,n),this.localCache[e]=JSON.stringify(n)}async _get(e){const n=await super._get(e);return this.localCache[e]=JSON.stringify(n),n}async _remove(e){await super._remove(e),delete this.localCache[e]}}nw.type="LOCAL";const _D=nw;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rw extends tw{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,n){}_removeListener(e,n){}}rw.type="SESSION";const sw=rw;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vD(t){return Promise.all(t.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(n){return{fulfilled:!1,reason:n}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ba{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const n=this.receivers.find(s=>s.isListeningto(e));if(n)return n;const r=new ba(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const n=e,{eventId:r,eventType:s,data:i}=n.data,o=this.handlersMap[s];if(!(o!=null&&o.size))return;n.ports[0].postMessage({status:"ack",eventId:r,eventType:s});const c=Array.from(o).map(async u=>u(n.origin,i)),l=await vD(c);n.ports[0].postMessage({status:"done",eventId:r,eventType:s,response:l})}_subscribe(e,n){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(n)}_unsubscribe(e,n){this.handlersMap[e]&&n&&this.handlersMap[e].delete(n),(!n||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}ba.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ah(t="",e=10){let n="";for(let r=0;r<e;r++)n+=Math.floor(Math.random()*10);return t+n}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wD{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,n,r=50){const s=typeof MessageChannel<"u"?new MessageChannel:null;if(!s)throw new Error("connection_unavailable");let i,o;return new Promise((c,l)=>{const u=ah("",20);s.port1.start();const h=setTimeout(()=>{l(new Error("unsupported_event"))},r);o={messageChannel:s,onMessage(f){const m=f;if(m.data.eventId===u)switch(m.data.status){case"ack":clearTimeout(h),i=setTimeout(()=>{l(new Error("timeout"))},3e3);break;case"done":clearTimeout(i),c(m.data.response);break;default:clearTimeout(h),clearTimeout(i),l(new Error("invalid_response"));break}}},this.handlers.add(o),s.port1.addEventListener("message",o.onMessage),this.target.postMessage({eventType:e,eventId:u,data:n},[s.port2])}).finally(()=>{o&&this.removeMessageHandler(o)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xt(){return window}function TD(t){xt().location.href=t}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function iw(){return typeof xt().WorkerGlobalScope<"u"&&typeof xt().importScripts=="function"}async function ED(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function ID(){var t;return((t=navigator==null?void 0:navigator.serviceWorker)==null?void 0:t.controller)||null}function bD(){return iw()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ow="firebaseLocalStorageDb",AD=1,Wo="firebaseLocalStorage",aw="fbase_key";class Ti{constructor(e){this.request=e}toPromise(){return new Promise((e,n)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{n(this.request.error)})})}}function Aa(t,e){return t.transaction([Wo],e?"readwrite":"readonly").objectStore(Wo)}function RD(){const t=indexedDB.deleteDatabase(ow);return new Ti(t).toPromise()}function Al(){const t=indexedDB.open(ow,AD);return new Promise((e,n)=>{t.addEventListener("error",()=>{n(t.error)}),t.addEventListener("upgradeneeded",()=>{const r=t.result;try{r.createObjectStore(Wo,{keyPath:aw})}catch(s){n(s)}}),t.addEventListener("success",async()=>{const r=t.result;r.objectStoreNames.contains(Wo)?e(r):(r.close(),await RD(),e(await Al()))})})}async function cm(t,e,n){const r=Aa(t,!0).put({[aw]:e,value:n});return new Ti(r).toPromise()}async function SD(t,e){const n=Aa(t,!1).get(e),r=await new Ti(n).toPromise();return r===void 0?null:r.value}function lm(t,e){const n=Aa(t,!0).delete(e);return new Ti(n).toPromise()}const PD=800,CD=3;class cw{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await Al(),this.db)}async _withRetries(e){let n=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(n++>CD)throw r;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return iw()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=ba._getInstance(bD()),this.receiver._subscribe("keyChanged",async(e,n)=>({keyProcessed:(await this._poll()).includes(n.key)})),this.receiver._subscribe("ping",async(e,n)=>["keyChanged"])}async initializeSender(){var n,r;if(this.activeServiceWorker=await ED(),!this.activeServiceWorker)return;this.sender=new wD(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&(n=e[0])!=null&&n.fulfilled&&(r=e[0])!=null&&r.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||ID()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await Al();return await cm(e,qo,"1"),await lm(e,qo),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,n){return this._withPendingWrite(async()=>(await this._withRetries(r=>cm(r,e,n)),this.localCache[e]=n,this.notifyServiceWorker(e)))}async _get(e){const n=await this._withRetries(r=>SD(r,e));return this.localCache[e]=n,n}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(n=>lm(n,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(s=>{const i=Aa(s,!1).getAll();return new Ti(i).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const n=[],r=new Set;if(e.length!==0)for(const{fbase_key:s,value:i}of e)r.add(s),JSON.stringify(this.localCache[s])!==JSON.stringify(i)&&(this.notifyListeners(s,i),n.push(s));for(const s of Object.keys(this.localCache))this.localCache[s]&&!r.has(s)&&(this.notifyListeners(s,null),n.push(s));return n}notifyListeners(e,n){this.localCache[e]=n;const r=this.listeners[e];if(r)for(const s of Array.from(r))s(n)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),PD)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,n){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(n)}_removeListener(e,n){this.listeners[e]&&(this.listeners[e].delete(n),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}cw.type="LOCAL";const kD=cw;new vi(3e4,6e4);/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ch(t,e){return e?Bt(e):(Y(t._popupRedirectResolver,t,"argument-error"),t._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lh extends Zv{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return kr(e,this._buildIdpRequest())}_linkToIdToken(e,n){return kr(e,this._buildIdpRequest(n))}_getReauthenticationResolver(e){return kr(e,this._buildIdpRequest())}_buildIdpRequest(e){const n={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(n.idToken=e),n}}function xD(t){return fD(t.auth,new lh(t),t.bypassAuthState)}function VD(t){const{auth:e,user:n}=t;return Y(n,e,"internal-error"),dD(n,new lh(t),t.bypassAuthState)}async function DD(t){const{auth:e,user:n}=t;return Y(n,e,"internal-error"),hD(n,new lh(t),t.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lw{constructor(e,n,r,s,i=!1){this.auth=e,this.resolver=r,this.user=s,this.bypassAuthState=i,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(n)?n:[n]}execute(){return new Promise(async(e,n)=>{this.pendingPromise={resolve:e,reject:n};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:n,sessionId:r,postBody:s,tenantId:i,error:o,type:c}=e;if(o){this.reject(o);return}const l={auth:this.auth,requestUri:n,sessionId:r,tenantId:i||void 0,postBody:s||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(c)(l))}catch(u){this.reject(u)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return xD;case"linkViaPopup":case"linkViaRedirect":return DD;case"reauthViaPopup":case"reauthViaRedirect":return VD;default:Mt(this.auth,"internal-error")}}resolve(e){Kt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){Kt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const MD=new vi(2e3,1e4);async function PN(t,e,n){if(nt(t.app))return Promise.reject(gt(t,"operation-not-supported-in-this-environment"));const r=Zr(t);Ov(t,e,Ia);const s=ch(r,n);return new Qn(r,"signInViaPopup",e,s).executeNotNull()}class Qn extends lw{constructor(e,n,r,s,i){super(e,n,s,i),this.provider=r,this.authWindow=null,this.pollId=null,Qn.currentPopupAction&&Qn.currentPopupAction.cancel(),Qn.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return Y(e,this.auth,"internal-error"),e}async onExecution(){Kt(this.filter.length===1,"Popup operations only handle one event");const e=ah();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(n=>{this.reject(n)}),this.resolver._isIframeWebStorageSupported(this.auth,n=>{n||this.reject(gt(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)==null?void 0:e.associatedEvent)||null}cancel(){this.reject(gt(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,Qn.currentPopupAction=null}pollUserCancellation(){const e=()=>{var n,r;if((r=(n=this.authWindow)==null?void 0:n.window)!=null&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(gt(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,MD.get())};e()}}Qn.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ND="pendingRedirect",mo=new Map;class LD extends lw{constructor(e,n,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],n,void 0,r),this.eventId=null}async execute(){let e=mo.get(this.auth._key());if(!e){try{const r=await OD(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(n){e=()=>Promise.reject(n)}mo.set(this.auth._key(),e)}return this.bypassAuthState||mo.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const n=await this.auth._redirectUserForId(e.eventId);if(n)return this.user=n,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function OD(t,e){const n=hw(e),r=uw(t);if(!await r._isAvailable())return!1;const s=await r._get(n)==="true";return await r._remove(n),s}async function FD(t,e){return uw(t)._set(hw(e),"true")}function UD(t,e){mo.set(t._key(),e)}function uw(t){return Bt(t._redirectPersistence)}function hw(t){return po(ND,t.config.apiKey,t.name)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function CN(t,e,n){return BD(t,e,n)}async function BD(t,e,n){if(nt(t.app))return Promise.reject(vn(t));const r=Zr(t);Ov(t,e,Ia),await r._initializationPromise;const s=ch(r,n);return await FD(s,r),s._openRedirect(r,e,"signInViaRedirect")}async function kN(t,e){return await Zr(t)._initializationPromise,dw(t,e,!1)}async function dw(t,e,n=!1){if(nt(t.app))return Promise.reject(vn(t));const r=Zr(t),s=ch(r,e),o=await new LD(r,s,n).execute();return o&&!n&&(delete o.user._redirectEventId,await r._persistUserIfCurrent(o.user),await r._setRedirectUser(null,e)),o}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const jD=600*1e3;class $D{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let n=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(n=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!zD(e)||(this.hasHandledPotentialRedirect=!0,n||(this.queuedRedirectEvent=e,n=!0)),n}sendToConsumer(e,n){var r;if(e.error&&!fw(e)){const s=((r=e.error.code)==null?void 0:r.split("auth/")[1])||"internal-error";n.onError(gt(this.auth,s))}else n.onAuthEvent(e)}isEventForConsumer(e,n){const r=n.eventId===null||!!e.eventId&&e.eventId===n.eventId;return n.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=jD&&this.cachedEventUids.clear(),this.cachedEventUids.has(um(e))}saveEventToCache(e){this.cachedEventUids.add(um(e)),this.lastProcessedEventTime=Date.now()}}function um(t){return[t.type,t.eventId,t.sessionId,t.tenantId].filter(e=>e).join("-")}function fw({type:t,error:e}){return t==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function zD(t){switch(t.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return fw(t);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function qD(t,e={}){return Jr(t,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const WD=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,HD=/^https?/;async function GD(t){if(t.config.emulator)return;const{authorizedDomains:e}=await qD(t);for(const n of e)try{if(KD(n))return}catch{}Mt(t,"unauthorized-domain")}function KD(t){const e=Il(),{protocol:n,hostname:r}=new URL(e);if(t.startsWith("chrome-extension://")){const o=new URL(t);return o.hostname===""&&r===""?n==="chrome-extension:"&&t.replace("chrome-extension://","")===e.replace("chrome-extension://",""):n==="chrome-extension:"&&o.hostname===r}if(!HD.test(n))return!1;if(WD.test(t))return r===t;const s=t.replace(/\./g,"\\.");return new RegExp("^(.+\\."+s+"|"+s+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const YD=new vi(3e4,6e4);function hm(){const t=xt().___jsl;if(t!=null&&t.H){for(const e of Object.keys(t.H))if(t.H[e].r=t.H[e].r||[],t.H[e].L=t.H[e].L||[],t.H[e].r=[...t.H[e].L],t.CP)for(let n=0;n<t.CP.length;n++)t.CP[n]=null}}function QD(t){return new Promise((e,n)=>{var s,i,o;function r(){hm(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{hm(),n(gt(t,"network-request-failed"))},timeout:YD.get()})}if((i=(s=xt().gapi)==null?void 0:s.iframes)!=null&&i.Iframe)e(gapi.iframes.getContext());else if((o=xt().gapi)!=null&&o.load)r();else{const c=sD("iframefcb");return xt()[c]=()=>{gapi.load?r():n(gt(t,"network-request-failed"))},nD(`${rD()}?onload=${c}`).catch(l=>n(l))}}).catch(e=>{throw go=null,e})}let go=null;function XD(t){return go=go||QD(t),go}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const JD=new vi(5e3,15e3),ZD="__/auth/iframe",e2="emulator/auth/iframe",t2={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},n2=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function r2(t){const e=t.config;Y(e.authDomain,t,"auth-domain-config-required");const n=e.emulator?nh(e,e2):`https://${t.config.authDomain}/${ZD}`,r={apiKey:e.apiKey,appName:t.name,v:Wr},s=n2.get(t.config.apiHost);s&&(r.eid=s);const i=t._getFrameworks();return i.length&&(r.fw=i.join(",")),`${n}?${li(r).slice(1)}`}async function s2(t){const e=await XD(t),n=xt().gapi;return Y(n,t,"internal-error"),e.open({where:document.body,url:r2(t),messageHandlersFilter:n.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:t2,dontclear:!0},r=>new Promise(async(s,i)=>{await r.restyle({setHideOnLeave:!1});const o=gt(t,"network-request-failed"),c=xt().setTimeout(()=>{i(o)},JD.get());function l(){xt().clearTimeout(c),s(r)}r.ping(l).then(l,()=>{i(o)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const i2={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},o2=500,a2=600,c2="_blank",l2="http://localhost";class dm{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function u2(t,e,n,r=o2,s=a2){const i=Math.max((window.screen.availHeight-s)/2,0).toString(),o=Math.max((window.screen.availWidth-r)/2,0).toString();let c="";const l={...i2,width:r.toString(),height:s.toString(),top:i,left:o},u=He().toLowerCase();n&&(c=Wv(u)?c2:n),zv(u)&&(e=e||l2,l.scrollbars="yes");const h=Object.entries(l).reduce((m,[y,w])=>`${m}${y}=${w},`,"");if(KV(u)&&c!=="_self")return h2(e||"",c),new dm(null);const f=window.open(e||"",c,h);Y(f,t,"popup-blocked");try{f.focus()}catch{}return new dm(f)}function h2(t,e){const n=document.createElement("a");n.href=t,n.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),n.dispatchEvent(r)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const d2="__/auth/handler",f2="emulator/auth/handler",p2=encodeURIComponent("fac");async function fm(t,e,n,r,s,i){Y(t.config.authDomain,t,"auth-domain-config-required"),Y(t.config.apiKey,t,"invalid-api-key");const o={apiKey:t.config.apiKey,appName:t.name,authType:n,redirectUrl:r,v:Wr,eventId:s};if(e instanceof Ia){e.setDefaultLanguage(t.languageCode),o.providerId=e.providerId||"",rC(e.getCustomParameters())||(o.customParameters=JSON.stringify(e.getCustomParameters()));for(const[h,f]of Object.entries({}))o[h]=f}if(e instanceof wi){const h=e.getScopes().filter(f=>f!=="");h.length>0&&(o.scopes=h.join(","))}t.tenantId&&(o.tid=t.tenantId);const c=o;for(const h of Object.keys(c))c[h]===void 0&&delete c[h];const l=await t._getAppCheckToken(),u=l?`#${p2}=${encodeURIComponent(l)}`:"";return`${m2(t)}?${li(c).slice(1)}${u}`}function m2({config:t}){return t.emulator?nh(t,f2):`https://${t.authDomain}/${d2}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rc="webStorageSupport";class g2{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=sw,this._completeRedirectFn=dw,this._overrideRedirectResult=UD}async _openPopup(e,n,r,s){var o;Kt((o=this.eventManagers[e._key()])==null?void 0:o.manager,"_initialize() not called before _openPopup()");const i=await fm(e,n,r,Il(),s);return u2(e,i,ah())}async _openRedirect(e,n,r,s){await this._originValidation(e);const i=await fm(e,n,r,Il(),s);return TD(i),new Promise(()=>{})}_initialize(e){const n=e._key();if(this.eventManagers[n]){const{manager:s,promise:i}=this.eventManagers[n];return s?Promise.resolve(s):(Kt(i,"If manager is not set, promise should be"),i)}const r=this.initAndGetManager(e);return this.eventManagers[n]={promise:r},r.catch(()=>{delete this.eventManagers[n]}),r}async initAndGetManager(e){const n=await s2(e),r=new $D(e);return n.register("authEvent",s=>(Y(s==null?void 0:s.authEvent,e,"invalid-auth-event"),{status:r.onEvent(s.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=n,r}_isIframeWebStorageSupported(e,n){this.iframes[e._key()].send(Rc,{type:Rc},s=>{var o;const i=(o=s==null?void 0:s[0])==null?void 0:o[Rc];i!==void 0&&n(!!i),Mt(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const n=e._key();return this.originValidationPromises[n]||(this.originValidationPromises[n]=GD(e)),this.originValidationPromises[n]}get _shouldInitProactively(){return Qv()||qv()||ih()}}const y2=g2;var pm="@firebase/auth",mm="1.12.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _2{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)==null?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const n=this.auth.onIdTokenChanged(r=>{e((r==null?void 0:r.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,n),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const n=this.internalListeners.get(e);n&&(this.internalListeners.delete(e),n(),this.updateProactiveRefresh())}assertAuthConfigured(){Y(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function v2(t){switch(t){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function w2(t){rr(new Tn("auth",(e,{options:n})=>{const r=e.getProvider("app").getImmediate(),s=e.getProvider("heartbeat"),i=e.getProvider("app-check-internal"),{apiKey:o,authDomain:c}=r.options;Y(o&&!o.includes(":"),"invalid-api-key",{appName:r.name});const l={apiKey:o,authDomain:c,clientPlatform:t,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:Xv(t)},u=new eD(r,s,i,l);return oD(u,n),u},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,n,r)=>{e.getProvider("auth-internal").initialize()})),rr(new Tn("auth-internal",e=>{const n=Zr(e.getProvider("auth").getImmediate());return(r=>new _2(r))(n)},"PRIVATE").setInstantiationMode("EXPLICIT")),jt(pm,mm,v2(t)),jt(pm,mm,"esm2020")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const T2=300,E2=Qy("authIdTokenMaxAge")||T2;let gm=null;const I2=t=>async e=>{const n=e&&await e.getIdTokenResult(),r=n&&(new Date().getTime()-Date.parse(n.issuedAtTime))/1e3;if(r&&r>E2)return;const s=n==null?void 0:n.token;gm!==s&&(gm=s,await fetch(t,{method:s?"POST":"DELETE",headers:s?{Authorization:`Bearer ${s}`}:{}}))};function xN(t=pu()){const e=sa(t,"auth");if(e.isInitialized())return e.getImmediate();const n=iD(t,{popupRedirectResolver:y2,persistence:[kD,_D,sw]}),r=Qy("authTokenSyncURL");if(r&&typeof isSecureContext=="boolean"&&isSecureContext){const i=new URL(r,location.origin);if(location.origin===i.origin){const o=I2(i.toString());mD(n,o,()=>o(n.currentUser)),pD(n,c=>o(c))}}const s=Gy("auth");return s&&aD(n,`http://${s}`),n}function b2(){var t;return((t=document.getElementsByTagName("head"))==null?void 0:t[0])??document}tD({loadJS(t){return new Promise((e,n)=>{const r=document.createElement("script");r.setAttribute("src",t),r.onload=e,r.onerror=s=>{const i=gt("internal-error");i.customData=s,n(i)},r.type="text/javascript",r.charset="UTF-8",b2().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});w2("Browser");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const A2="type.googleapis.com/google.protobuf.Int64Value",R2="type.googleapis.com/google.protobuf.UInt64Value";function pw(t,e){const n={};for(const r in t)t.hasOwnProperty(r)&&(n[r]=e(t[r]));return n}function Ho(t){if(t==null)return null;if(t instanceof Number&&(t=t.valueOf()),typeof t=="number"&&isFinite(t)||t===!0||t===!1||Object.prototype.toString.call(t)==="[object String]")return t;if(t instanceof Date)return t.toISOString();if(Array.isArray(t))return t.map(e=>Ho(e));if(typeof t=="function"||typeof t=="object")return pw(t,e=>Ho(e));throw new Error("Data cannot be encoded in JSON: "+t)}function Fr(t){if(t==null)return t;if(t["@type"])switch(t["@type"]){case A2:case R2:{const e=Number(t.value);if(isNaN(e))throw new Error("Data cannot be decoded from JSON: "+t);return e}default:throw new Error("Data cannot be decoded from JSON: "+t)}return Array.isArray(t)?t.map(e=>Fr(e)):typeof t=="function"||typeof t=="object"?pw(t,e=>Fr(e)):t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const uh="functions";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ym={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class et extends Ot{constructor(e,n,r){super(`${uh}/${e}`,n||""),this.details=r,Object.setPrototypeOf(this,et.prototype)}}function S2(t){if(t>=200&&t<300)return"ok";switch(t){case 0:return"internal";case 400:return"invalid-argument";case 401:return"unauthenticated";case 403:return"permission-denied";case 404:return"not-found";case 409:return"aborted";case 429:return"resource-exhausted";case 499:return"cancelled";case 500:return"internal";case 501:return"unimplemented";case 503:return"unavailable";case 504:return"deadline-exceeded"}return"unknown"}function Go(t,e){let n=S2(t),r=n,s;try{const i=e&&e.error;if(i){const o=i.status;if(typeof o=="string"){if(!ym[o])return new et("internal","internal");n=ym[o],r=o}const c=i.message;typeof c=="string"&&(r=c),s=i.details,s!==void 0&&(s=Fr(s))}}catch{}return n==="ok"?null:new et(n,r,s)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class P2{constructor(e,n,r,s){this.app=e,this.auth=null,this.messaging=null,this.appCheck=null,this.serverAppAppCheckToken=null,nt(e)&&e.settings.appCheckToken&&(this.serverAppAppCheckToken=e.settings.appCheckToken),this.auth=n.getImmediate({optional:!0}),this.messaging=r.getImmediate({optional:!0}),this.auth||n.get().then(i=>this.auth=i,()=>{}),this.messaging||r.get().then(i=>this.messaging=i,()=>{}),this.appCheck||s==null||s.get().then(i=>this.appCheck=i,()=>{})}async getAuthToken(){if(this.auth)try{const e=await this.auth.getToken();return e==null?void 0:e.accessToken}catch{return}}async getMessagingToken(){if(!(!this.messaging||!("Notification"in self)||Notification.permission!=="granted"))try{return await this.messaging.getToken()}catch{return}}async getAppCheckToken(e){if(this.serverAppAppCheckToken)return this.serverAppAppCheckToken;if(this.appCheck){const n=e?await this.appCheck.getLimitedUseToken():await this.appCheck.getToken();return n.error?null:n.token}return null}async getContext(e){const n=await this.getAuthToken(),r=await this.getMessagingToken(),s=await this.getAppCheckToken(e);return{authToken:n,messagingToken:r,appCheckToken:s}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rl="us-central1",C2=/^data: (.*?)(?:\n|$)/;function k2(t){let e=null;return{promise:new Promise((n,r)=>{e=setTimeout(()=>{r(new et("deadline-exceeded","deadline-exceeded"))},t)}),cancel:()=>{e&&clearTimeout(e)}}}class x2{constructor(e,n,r,s,i=Rl,o=(...c)=>fetch(...c)){this.app=e,this.fetchImpl=o,this.emulatorOrigin=null,this.contextProvider=new P2(e,n,r,s),this.cancelAllRequests=new Promise(c=>{this.deleteService=()=>Promise.resolve(c())});try{const c=new URL(i);this.customDomain=c.origin+(c.pathname==="/"?"":c.pathname),this.region=Rl}catch{this.customDomain=null,this.region=i}}_delete(){return this.deleteService()}_url(e){const n=this.app.options.projectId;return this.emulatorOrigin!==null?`${this.emulatorOrigin}/${n}/${this.region}/${e}`:this.customDomain!==null?`${this.customDomain}/${e}`:`https://${this.region}-${n}.cloudfunctions.net/${e}`}}function V2(t,e,n){const r=ur(e);t.emulatorOrigin=`http${r?"s":""}://${e}:${n}`,r&&hu(t.emulatorOrigin+"/backends")}function D2(t,e,n){const r=s=>N2(t,e,s,{});return r.stream=(s,i)=>O2(t,e,s,i),r}function mw(t){return t.emulatorOrigin&&ur(t.emulatorOrigin)?"include":void 0}async function M2(t,e,n,r,s){n["Content-Type"]="application/json";let i;try{i=await r(t,{method:"POST",body:JSON.stringify(e),headers:n,credentials:mw(s)})}catch{return{status:0,json:null}}let o=null;try{o=await i.json()}catch{}return{status:i.status,json:o}}async function gw(t,e){const n={},r=await t.contextProvider.getContext(e.limitedUseAppCheckTokens);return r.authToken&&(n.Authorization="Bearer "+r.authToken),r.messagingToken&&(n["Firebase-Instance-ID-Token"]=r.messagingToken),r.appCheckToken!==null&&(n["X-Firebase-AppCheck"]=r.appCheckToken),n}function N2(t,e,n,r){const s=t._url(e);return L2(t,s,n,r)}async function L2(t,e,n,r){n=Ho(n);const s={data:n},i=await gw(t,r),o=r.timeout||7e4,c=k2(o),l=await Promise.race([M2(e,s,i,t.fetchImpl,t),c.promise,t.cancelAllRequests]);if(c.cancel(),!l)throw new et("cancelled","Firebase Functions instance was deleted.");const u=Go(l.status,l.json);if(u)throw u;if(!l.json)throw new et("internal","Response is not valid JSON object.");let h=l.json.data;if(typeof h>"u"&&(h=l.json.result),typeof h>"u")throw new et("internal","Response is missing data field.");return{data:Fr(h)}}function O2(t,e,n,r){const s=t._url(e);return F2(t,s,n,r||{})}async function F2(t,e,n,r){var m;n=Ho(n);const s={data:n},i=await gw(t,r);i["Content-Type"]="application/json",i.Accept="text/event-stream";let o;try{o=await t.fetchImpl(e,{method:"POST",body:JSON.stringify(s),headers:i,signal:r==null?void 0:r.signal,credentials:mw(t)})}catch(y){if(y instanceof Error&&y.name==="AbortError"){const R=new et("cancelled","Request was cancelled.");return{data:Promise.reject(R),stream:{[Symbol.asyncIterator](){return{next(){return Promise.reject(R)}}}}}}const w=Go(0,null);return{data:Promise.reject(w),stream:{[Symbol.asyncIterator](){return{next(){return Promise.reject(w)}}}}}}let c,l;const u=new Promise((y,w)=>{c=y,l=w});(m=r==null?void 0:r.signal)==null||m.addEventListener("abort",()=>{const y=new et("cancelled","Request was cancelled.");l(y)});const h=o.body.getReader(),f=U2(h,c,l,r==null?void 0:r.signal);return{stream:{[Symbol.asyncIterator](){const y=f.getReader();return{async next(){const{value:w,done:R}=await y.read();return{value:w,done:R}},async return(){return await y.cancel(),{done:!0,value:void 0}}}}},data:u}}function U2(t,e,n,r){const s=(o,c)=>{const l=o.match(C2);if(!l)return;const u=l[1];try{const h=JSON.parse(u);if("result"in h){e(Fr(h.result));return}if("message"in h){c.enqueue(Fr(h.message));return}if("error"in h){const f=Go(0,h);c.error(f),n(f);return}}catch(h){if(h instanceof et){c.error(h),n(h);return}}},i=new TextDecoder;return new ReadableStream({start(o){let c="";return l();async function l(){if(r!=null&&r.aborted){const u=new et("cancelled","Request was cancelled");return o.error(u),n(u),Promise.resolve()}try{const{value:u,done:h}=await t.read();if(h){c.trim()&&s(c.trim(),o),o.close();return}if(r!=null&&r.aborted){const m=new et("cancelled","Request was cancelled");o.error(m),n(m),await t.cancel();return}c+=i.decode(u,{stream:!0});const f=c.split(`
`);c=f.pop()||"";for(const m of f)m.trim()&&s(m.trim(),o);return l()}catch(u){const h=u instanceof et?u:Go(0,null);o.error(h),n(h)}}},cancel(){return t.cancel()}})}const _m="@firebase/functions",vm="0.13.3";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const B2="auth-internal",j2="app-check-internal",$2="messaging-internal";function z2(t){const e=(n,{instanceIdentifier:r})=>{const s=n.getProvider("app").getImmediate(),i=n.getProvider(B2),o=n.getProvider($2),c=n.getProvider(j2);return new x2(s,i,o,c,r)};rr(new Tn(uh,e,"PUBLIC").setMultipleInstances(!0)),jt(_m,vm,t),jt(_m,vm,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function VN(t=pu(),e=Rl){const r=sa(ge(t),uh).getImmediate({identifier:e}),s=Ky("functions");return s&&q2(r,...s),r}function q2(t,e,n){V2(ge(t),e,n)}function DN(t,e,n){return D2(ge(t),e)}z2();export{dN as $,rN as A,K2 as B,nM as C,lM as D,UT as E,BM as F,un as G,_M as H,gM as I,pM as J,aM as K,TM as L,VM as M,X2 as N,sM as O,OM as P,H2 as Q,FM as R,qM as S,YM as T,zM as U,AM as V,kN as W,ZM as X,eN as Y,SN as Z,yN as _,uN as a,SM as a0,XM as a1,JM as a2,$M as a3,HM as a4,yM as a5,mM as a6,WM as a7,xM as a8,kM as a9,DM as aA,wM as aB,vM as aC,UM as aD,uM as aE,bM as aF,QM as aG,RM as aH,Y2 as aI,cM as aJ,dM as aK,oM as aL,DN as aM,iM as aN,jM as aO,AN as aa,_D as ab,sw as ac,PN as ad,CN as ae,MM as af,NM as ag,CM as ah,LM as ai,PM as aj,IM as ak,iN as al,KM as am,GM as an,TN as ao,EN as ap,hN as aq,bN as ar,hM as as,tN as at,sN as au,oN as av,J2 as aw,fM as ax,EM as ay,Om as az,VN as b,eM as c,Q2 as d,tM as e,Z2 as f,xN as g,rM as h,i1 as i,Lt as j,lN as k,IN as l,Ry as m,RN as n,mN as o,vV as p,fN as q,jt as r,gN as s,aN as t,xm as u,_N as v,pN as w,vN as x,wN as y,G2 as z};
