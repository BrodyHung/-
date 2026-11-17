import {type Config, type Point,validate} from './model';
import {hex,inset,rectangle,fits,bounds,transform,overlaps,area,bodyArea,EPS,packageSupport,minimumRect,envelope,rad} from './geometry';
import {materialEstimate} from './materials';
export type Cell={center:Point;polygon:Point[];inner:Point[];rotated:boolean};
export type Result={kind:'hex'|'grid';theta:number;cells:Cell[];layers:number;count:number;rows:number;cols:number;rotated:boolean;packageRotated:boolean;innerArea:number;wallLength:number;theoretical:number;cutArea:number;stockArea:number;perItem:number|null;occupiedVolume:number;density:number;boxUtil:number;cellUtil:number;usedLength:number;usedWidth:number;remainingLength:number;remainingWidth:number;tabs:Point[][];pieces:{length:number;height:number;quantity:number;area:number}[];reason:string;pattern:string};
export function geometry(c:Config,theta=c.theta){
 if(c.snug){
  const angle=rad(theta),margin=c.cushion+c.clearance+c.thickness/2;
  const v=packageSupport(c,0,1)+margin,s=v/Math.sin(angle);
  const a=Math.max(1e-4,2*(packageSupport(c,Math.sin(angle),Math.cos(angle))+margin-v*Math.cos(angle))/Math.sin(angle));
  return {...hex(a,s,theta),a,s};
 }
 let s=c.s;
 const perimeter=c.bagPerimeter||2*(c.bagLength+c.bagWidth);
 if(c.perimeterCandidate&&perimeter>0)s=(perimeter-2*c.a)/4;
 if(c.control==='width')s=(c.targetWidth-c.a)/(2*Math.cos(theta*Math.PI/180));
 if(c.control==='height')s=c.targetHeight/(2*Math.sin(theta*Math.PI/180));
 return {...hex(c.a,s,theta),a:c.a,s};
}
export function rectGeometry(c:Config){return c.snug?minimumRect(c):{length:c.rectLength,width:c.rectWidth}}
function empty(kind:'hex'|'grid',theta:number,reason:string):Result{return {kind,theta,cells:[],layers:0,count:0,rows:0,cols:0,rotated:false,packageRotated:false,innerArea:0,wallLength:0,theoretical:0,cutArea:0,stockArea:0,perItem:null,occupiedVolume:0,density:0,boxUtil:0,cellUtil:0,usedLength:0,usedWidth:0,remainingLength:0,remainingWidth:0,tabs:[],pieces:[],reason,pattern:'規則排列搜尋結果'}}
function finish(c:Config,r:Result,height:number,t:number,extra:number){
 const layerHeight=Math.max(height,c.T+2*(c.cushion+c.clearance));
 r.layers=c.multilayer?Math.floor((c.boxHeight-2*c.boxGap)/layerHeight):Number(layerHeight<=c.boxHeight-2*c.boxGap);
 if(r.layers<1)return empty(r.kind,r.theta,'外箱高度不足，無可行排列');
 r.count=r.cells.length*r.layers;
 const tabs=r.tabs.length*c.tabLength*c.tabWidth;
 const material=materialEstimate(r.cells.map(x=>x.polygon),r.kind==='grid'||c.shared,height,r.layers,extra*r.cells.length+(r.kind==='hex'?c.returnArea:0)+tabs,c.waste);
 r.wallLength=material.length;r.theoretical=material.theoretical;r.cutArea=material.cutArea;r.stockArea=material.stockArea;r.pieces=material.pieces;r.perItem=r.count?r.stockArea/r.count:null;
 const b=bounds(r.cells.flatMap(x=>inset(x.polygon,-t/2)).concat(r.tabs.flat()));
 r.usedLength=b.maxX-b.minX;r.usedWidth=b.maxY-b.minY;
 r.remainingLength=Math.max(0,c.boxLength-2*c.boxGap-r.usedLength);r.remainingWidth=Math.max(0,c.boxWidth-2*c.boxGap-r.usedWidth);
 r.occupiedVolume=r.usedLength*r.usedWidth*layerHeight*r.layers;
 r.density=r.count/(c.boxLength*c.boxWidth*c.boxHeight);
 r.boxUtil=r.cells.length*bodyArea(c)/(c.boxLength*c.boxWidth);
 r.cellUtil=r.innerArea?bodyArea(c)/r.innerArea:0;
 return r;
}
export function pack(c:Config,kind:'hex'|'grid',theta=c.theta):Result{
 const errors=validate(c);if(errors.length)return empty(kind,theta,errors.join('；'));
 const t=kind==='hex'?c.thickness:c.rectThickness,h=kind==='hex'?c.height:c.rectHeight;
 const g=geometry(c,theta),rect=rectGeometry(c);const base=kind==='hex'?g.points:rectangle(rect.length+t,rect.width+t);
 if(kind==='hex'&&(!Number.isFinite(g.width)||g.width<=g.a||g.height<=0))return empty(kind,theta,'候選尺寸退化，請檢查主要控制參數或周長');
 const inner=inset(base,t/2);const pr=[false,...(c.rotate?[true]:[])].find(rotate=>fits(c,inner,rotate));
 if(pr===undefined)return empty(kind,theta,!envelope(c).known?(c.packageProfile==='flat'?'僅憑周長無法確認醫材能否放入，請補充滅菌袋長寬。':'請輸入單側堆積餘料延伸，或提供袋長以產生候選輪廓；無可行解'):'本體或袋材包絡輪廓超出安全淨空，無可行解');
 let best=empty(kind,theta,'外箱邊界或定位片空間不足，無可行排列');
 for(const rotated of [false,...(c.rotate?[true]:[])]){
  const oriented=transform(base,0,0,rotated),ib=transform(inner,0,0,rotated),b=bounds(oriented),w=b.maxX-b.minX,hh=b.maxY-b.minY;
  const tabReserve=kind==='hex'&&c.tabCount>0?c.tabLength:0;
  if(tabReserve&&Math.ceil(c.tabCount/2)*c.tabWidth>c.boxWidth-2*c.boxGap)continue;
  const left=c.boxGap+tabReserve,top=c.boxGap,right=c.boxLength-c.boxGap-tabReserve,bottom=c.boxWidth-c.boxGap;
  const outerBounds=bounds(inset(oriented,-t/2));
  // Canonical tiling plus disjoint bounding-grid family; finite offset samples.
  const patterns=kind==='grid'?[{dx:w,dy:hh,off:0,label:'矩形網格'}]:[
   {dx:rotated?w:g.width-(g.width-g.a)/2,dy:rotated?g.height-(g.height-g.a)/2:g.height,off:0.5,label:'共邊蜂巢'},
   {dx:w+(c.shared?0:t),dy:hh+(c.shared?0:t),off:0,label:'直列'},
   {dx:w+(c.shared?0:t),dy:hh+(c.shared?0:t),off:c.offset,label:'自訂錯位'}];
  // Rotated canonical lattice is generated in source coordinates below.
  for(const pattern of patterns){
   if(pattern.label==='共邊蜂巢'&&!c.shared)continue;
   const cells:Cell[]=[];let usedRows=0,usedCols=0;
   const bucketWidth=outerBounds.maxX-outerBounds.minX,bucketHeight=outerBounds.maxY-outerBounds.minY;
   const buckets=new Map<string,{cell:Cell;physical:Point[]}[]>();
   const maxC=kind==='hex'?c.cols:c.rectVertical+1,maxR=kind==='hex'?c.rows:c.rectHorizontal+1;
   for(let col=0;col<maxC;col++)for(let row=0;row<maxR;row++){
    let x=left-outerBounds.minX+col*pattern.dx,y=top-outerBounds.minY+row*pattern.dy+(col%2)*pattern.off*hh;
    if(rotated&&pattern.label==='共邊蜂巢'){x=left-outerBounds.minX+row*g.height+(col%2)*g.height/2;y=top-outerBounds.minY+col*(g.a+(g.width-g.a)/2)}
    const p=transform(oriented,x,y),physical=inset(p,-t/2);
    const physicalBounds=bounds(physical);
    if(physicalBounds.minX<left-EPS||physicalBounds.maxX>right+EPS||physicalBounds.minY<top-EPS||physicalBounds.maxY>bottom+EPS)continue;
    const outer=c.shared||kind==='grid'?p:physical;
    // Uniform spatial hash is a conservative broad phase; exact SAT is final.
    const bx=Math.floor(x/bucketWidth),by=Math.floor(y/bucketHeight);
    let collision=false;
    for(let xx=bx-1;xx<=bx+1&&!collision;xx++)for(let yy=by-1;yy<=by+1&&!collision;yy++)for(const neighbor of buckets.get(`${xx},${yy}`)??[]){if(overlaps(outer,c.shared||kind==='grid'?neighbor.cell.polygon:neighbor.physical)){collision=true;break}}
    if(collision)continue;
    const cell={center:{x,y},polygon:p,inner:transform(ib,x,y),rotated:rotated!==pr};cells.push(cell);
    const key=`${bx},${by}`,bucket=buckets.get(key)??[];bucket.push({cell,physical});buckets.set(key,bucket);
    usedRows=Math.max(usedRows,row+1);usedCols=Math.max(usedCols,col+1);
   }
   if(!cells.length)continue;
   const tabs:Point[][]=[];
   if(tabReserve)for(let i=0;i<c.tabCount;i++){const x=i%2===0?c.boxGap+c.tabLength/2:c.boxLength-c.boxGap-c.tabLength/2;const y=c.boxGap+(Math.floor(i/2)+.5)*c.tabWidth;tabs.push(transform(rectangle(c.tabLength,c.tabWidth),x,y))}
   const r=finish(c,{...empty(kind,theta,''),cells,rows:usedRows,cols:usedCols,rotated,packageRotated:pr,innerArea:area(inner),tabs,pattern:`規則排列搜尋結果 · ${pattern.label}`},h,t,kind==='hex'?c.extraArea:c.rectExtra);
   if(r.count>best.count||(r.count===best.count&&r.count>0&&r.stockArea<best.stockArea))best=r;
  }
 }
 return best;
}
export function score(r:Result,objective:Config['objective']){return objective==='count'?-r.count:objective==='material'?r.perItem??Infinity:r.count?r.occupiedVolume:Infinity}
export function optimize(c:Config){
 if(validate(c).length)return [];
 const angles:number[]=[];for(let angle=c.minAngle;angle<=c.maxAngle+EPS;angle+=c.step)angles.push(Math.min(angle,c.maxAngle));if(Math.abs(angles.at(-1)!-c.maxAngle)>EPS)angles.push(c.maxAngle);
 return angles.map(a=>pack({...c,control:'angle'},'hex',a)).sort((a,b)=>score(a,c.objective)-score(b,c.objective)||a.theta-b.theta);
}
export function percentChange(a:number,b:number,reduction=false){return b>0?(reduction?1-a/b:a/b-1)*100:null}
export function compare(hex:Result,grid:Result){return {loading:percentChange(hex.count,grid.count),totalPaper:percentChange(hex.stockArea,grid.stockArea,true),perItem:hex.perItem!==null&&grid.perItem!==null?percentChange(hex.perItem,grid.perItem,true):null}}
