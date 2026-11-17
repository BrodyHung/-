import type { Config,Point } from './model';
export const EPS=1e-6;
export const rad=(d:number)=>d*Math.PI/180;
export const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function hex(a:number,s:number,theta:number){
 const u=s*Math.cos(rad(theta)),v=s*Math.sin(rad(theta));
 return {width:a+2*u,height:2*v,area:2*v*(a+u),perimeter:2*a+4*s,points:[{x:-a/2,y:-v},{x:a/2,y:-v},{x:a/2+u,y:0},{x:a/2,y:v},{x:-a/2,y:v},{x:-a/2-u,y:0}]};
}
export function area(p:Point[]){return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-a.y*b.x},0))/2}
export function bounds(p:Point[]){return {minX:Math.min(...p.map(p=>p.x)),maxX:Math.max(...p.map(p=>p.x)),minY:Math.min(...p.map(p=>p.y)),maxY:Math.max(...p.map(p=>p.y))}}
export function transform(p:Point[],x=0,y=0,rotate=false):Point[]{return p.map(p=>rotate?{x:-p.y+x,y:p.x+y}:{x:p.x+x,y:p.y+y})}
export function rectangle(w:number,h:number):Point[]{return [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}]}
// Offset every CCW supporting line inward. Positive d removes wall thickness.
export function inset(p:Point[],d:number):Point[]{
 const lines=p.map((a,i)=>{const b=p[(i+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);return {x:a.x-dy/l*d,y:a.y+dx/l*d,dx,dy}});
 const q=lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],den=a.dx*b.dy-a.dy*b.dx;const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den;return {x:a.x+t*a.dx,y:a.y+t*a.dy}});
 return q.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&p.every((b,i)=>{const e=p[(i+1)%p.length];return cross(b,e,a)>=d*Math.hypot(e.x-b.x,e.y-b.y)-EPS}))?q:[];
}
export function contains(container:Point[],outline:Point[]):boolean{return container.length>=3&&outline.length>0&&outline.every(p=>container.every((a,i)=>cross(a,container[(i+1)%container.length],p)>=-EPS))}
// Separating axis theorem: touching boundaries are allowed, positive-area overlap is not.
export function overlaps(a:Point[],b:Point[]):boolean{
 return [a,b].every(poly=>poly.every((p,i)=>{const q=poly[(i+1)%poly.length],nx=-(q.y-p.y),ny=q.x-p.x;const aa=a.map(p=>p.x*nx+p.y*ny),bb=b.map(p=>p.x*nx+p.y*ny);return Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))>EPS*Math.hypot(nx,ny)}));
}
export function body(c:Config):Point[]{
 const w=c.D,h=c.shape==='circle'?c.D:c.bodyWidth;
 if(c.shape==='rectangle') return rectangle(w,h);
 const r=c.shape==='circle'?w/2:Math.min(c.radius,w/2,h/2);
 const result:Point[]=[];
 for(let k=0;k<4;k++) for(let j=0;j<=16;j++){const angle=(-90+k*90+j*90/16)*Math.PI/180; const cx=k===0||k===1?w/2-r:-w/2+r,cy=k<2?(k===0?-h/2+r:h/2-r):(k===2?h/2-r:-h/2+r);result.push({x:cx+r*Math.cos(angle),y:cy+r*Math.sin(angle)})}return result;
}
export function bodyArea(c:Config){if(c.shape==='circle')return Math.PI*c.D*c.D/4;const r=c.shape==='rounded'?Math.min(c.radius,c.D/2,c.bodyWidth/2):0;return c.D*c.bodyWidth-(4-Math.PI)*r*r}
export function bodySupport(c:Config,nx:number,ny:number){
 const w=c.D,h=c.shape==='circle'?c.D:c.bodyWidth;
 const r=c.shape==='circle'?c.D/2:c.shape==='rounded'?Math.min(c.radius,w/2,h/2):0;
 return (w/2-r)*Math.abs(nx)+(h/2-r)*Math.abs(ny)+r*Math.hypot(nx,ny);
}
export function sideExtension(c:Config){return c.extensionMode==='manual'?c.extension:Math.max(0,(c.bagLength-c.D)/2)}
export function convexHull(points:Point[]):Point[]{
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
 const half=(ps:Point[])=>{const result:Point[]=[];for(const p of ps){while(result.length>=2&&cross(result.at(-2)!,result.at(-1)!,p)<=EPS)result.pop();result.push(p)}return result};
 const lower=half(sorted),upper=half([...sorted].reverse());return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
export function envelope(c:Config){
 if(c.packageProfile==='gathered'){
  const extension=sideExtension(c),tip=c.D/2+extension;
  const known=c.extensionMode==='manual'||c.bagLength>0;
  const points=known?convexHull([...body(c),{x:-tip,y:0},{x:tip,y:0}]):[];
  return {known,length:c.D+2*extension,width:c.shape==='circle'?c.D:c.bodyWidth,points};
 }
 const known=c.bagLength>0&&c.bagWidth>0;
 const length=known?Math.max(c.bagLength,c.D+(c.extensionMode==='manual'?2*c.extension:0)):0;
 return {known,length,width:c.bagWidth,points:known?rectangle(length,c.bagWidth):[]};
}
// Exact support of convex(body + two side tips), or the legacy flat rectangle.
export function packageSupport(c:Config,nx:number,ny:number){
 if(c.packageProfile==='gathered')return Math.max(bodySupport(c,nx,ny),(c.D/2+sideExtension(c))*Math.abs(nx));
 const bag=envelope(c);return Math.max(bodySupport(c,nx,ny),bag.length/2*Math.abs(nx)+bag.width/2*Math.abs(ny));
}
export function minimumRect(c:Config){const margin=2*(c.cushion+c.clearance);return {length:2*packageSupport(c,1,0)+margin,width:2*packageSupport(c,0,1)+margin}}
export function fits(c:Config,inner:Point[],rotate=false){
 const bag=envelope(c); if(!bag.known)return false;
 const safe=inset(inner,c.cushion+c.clearance); if(safe.length<3)return false;
 // Inverse-rotate edge normals into package coordinates. This includes exact
 // curved-body support; sampled drawing outlines never certify a fit.
 return safe.every((a,i)=>{const b=safe[(i+1)%safe.length],len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;return cross(a,b,{x:0,y:0})/len>=packageSupport(c,rotate?ny:nx,rotate?-nx:ny)-EPS});
}
export type Segment=[Point,Point];
export function edges(p:Point[]):Segment[]{return p.map((a,i)=>[a,p[(i+1)%p.length]])}
// Union collinear projected intervals, including partial shared edges.
export function wallLength(polys:Point[][],shared:boolean){
 return wallPieces(polys,shared).reduce((a,b)=>a+b,0);
}
export function wallPieces(polys:Point[][],shared:boolean){
 const groups=new Map<string,{u:Point;intervals:[number,number][]}>();
 const pieces:number[]=[];
 for(const p of polys)for(const [a,b]of edges(p)){const len=Math.hypot(b.x-a.x,b.y-a.y);if(!shared){pieces.push(len);continue}let ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;if(ux<-EPS||(Math.abs(ux)<EPS&&uy<0)){ux=-ux;uy=-uy}const offset=-uy*a.x+ux*a.y;const key=[ux,uy,offset].map(n=>n.toFixed(5)).join(',');const g=groups.get(key)??{u:{x:ux,y:uy},intervals:[]};const x=a.x*ux+a.y*uy,y=b.x*ux+b.y*uy;g.intervals.push([Math.min(x,y),Math.max(x,y)]);groups.set(key,g)}
 for(const g of groups.values()){g.intervals.sort((a,b)=>a[0]-b[0]);let start=Infinity,end=-Infinity;for(const [a,b]of g.intervals){if(a>end+EPS){if(Number.isFinite(start))pieces.push(end-start);start=a;end=b}else end=Math.max(end,b)}if(Number.isFinite(start))pieces.push(end-start)}return pieces;
}
