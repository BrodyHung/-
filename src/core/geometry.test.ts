import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate,importConfig,type Config} from './model';
import {hex,area,inset,rectangle,contains,transform,overlaps,wallLength,fits,bounds,bodyArea,envelope,minimumRect,sideExtension,packageSupport} from './geometry';
import {pack,optimize,compare,percentChange,geometry,score,rectGeometry} from './packing';
import {materialEstimate} from './materials';
const close=(a:number,b:number,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const base:Config={...defaults,packageProfile:'flat',snug:false,extensionMode:'auto'};
test('known regular hexagon width, height, area, perimeter and shoelace agree',()=>{const g=hex(100,100,60);close(g.width,200);close(g.height,100*Math.sqrt(3));close(g.area,15000*Math.sqrt(3));close(g.perimeter,600);close(area(g.points),g.area)});
test('angle increases height, decreases width for fixed a,s',()=>{const a=hex(60,80,25),b=hex(60,80,65);assert.ok(a.width>b.width);assert.ok(a.height<b.height)});
test('wall inset removes normal half thickness, not width-only estimate',()=>{const p=hex(100,100,60).points,q=inset(p,2);close(bounds(q).maxY,bounds(p).maxY-2);assert.ok(area(q)<area(p));assert.equal(inset(p,1000).length,0)});
test('polygon containment rejects corners outside despite adequate height',()=>{const p=hex(20,100,60).points;assert.ok(!contains(p,rectangle(180,100)));assert.ok(contains(p,rectangle(20,20)))});
test('bag and body must both fit, perimeter alone cannot confirm',()=>{const c={...base,bagLength:0,bagPerimeter:500};assert.equal(pack(c,'hex').count,0);assert.match(pack(c,'hex').reason,/僅憑周長/);assert.equal(fits({...base,bagLength:10000},hex(110,100,55).points),false)});
test('circle uses analytic support near a face between sampled points',()=>{const c={...base,D:100,cushion:0,clearance:0,bagLength:1,bagWidth:1};assert.equal(fits(c,rectangle(99.99,120)),false);assert.equal(fits(c,rectangle(100,120)),true)});
test('SAT permits shared boundaries but rejects positive interior overlaps',()=>{const p=rectangle(10,10);assert.equal(overlaps(p,transform(p,10,0)),false);assert.equal(overlaps(p,transform(p,9.9,0)),true)});
test('shared hex wall union removes one shared edge',()=>{const g=hex(100,100,60),q=transform(g.points,150,g.height/2);close(wallLength([g.points,q],false),1200);close(wallLength([g.points,q],true),1100)});
test('partial collinear overlap is counted only once',()=>{const p=rectangle(20,10),q=transform(rectangle(10,10),5,10);close(wallLength([p,q],true),90)});
test('actual outer wall polygons and tabs remain within box',()=>{for(const kind of ['hex','grid'] as const)for(const angle of [35,55,70]){const r=pack({...base,theta:angle},kind);for(const cell of r.cells){const b=bounds(inset(cell.polygon,-base.thickness/2));assert.ok(b.minX>=base.boxGap-1e-6);assert.ok(b.maxX<=base.boxLength-base.boxGap+1e-6);assert.ok(b.minY>=base.boxGap-1e-6);assert.ok(b.maxY<=base.boxWidth-base.boxGap+1e-6)}for(const p of r.tabs){const b=bounds(p);assert.ok(b.minX>=base.boxGap);assert.ok(b.maxX<=base.boxLength-base.boxGap)}for(let i=0;i<r.cells.length;i++)for(let j=0;j<i;j++)assert.equal(overlaps(r.cells[i].polygon,r.cells[j].polygon),false)}});
test('rotation recalculates packing capacity in a narrow box',()=>{const c={...base,D:8,T:10,bagLength:30,bagWidth:10,cushion:1,clearance:1,rectLength:34,rectWidth:14,rectThickness:2,rectHeight:20,boxLength:30,boxWidth:74,boxHeight:40,boxGap:0,multilayer:false};assert.equal(pack({...c,rotate:false},'grid').count,0);assert.equal(pack({...c,rotate:true},'grid').count,2)});
test('negative, NaN, infinity, zero division, fractional counts and huge search rejected',()=>{for(const patch of [{D:-1},{D:NaN},{boxLength:0},{step:0},{s:Infinity},{rows:1.5},{cols:41},{step:.00001}]){const c={...base,...patch};assert.ok(validate(c).length>0);assert.equal(pack(c,'hex').count,0);assert.equal(optimize(c).length,0)}});
test('malformed JSON cannot replace validated config',()=>{assert.throws(()=>importConfig({config:{D:'100'}}));assert.throws(()=>importConfig({shape:'star'}));assert.deepEqual(importConfig({config:base}),base)});
test('material categories, individual cut pieces and efficiency formulas',()=>{const m=materialEstimate([rectangle(10,20)],true,30,2,100,10);close(m.length,60);close(m.theoretical,3600);close(m.cutArea,3800);close(m.stockArea,4180);close(m.pieces.reduce((s,p)=>s+p.area,0),m.theoretical);close(percentChange(12,10)!,20);close(percentChange(8,10,true)!,20);assert.equal(percentChange(1,0),null);const a=pack(base,'hex'),b=pack(base,'grid'),d=compare(a,b);close(d.loading!,(a.count/b.count-1)*100);close(a.perItem!,a.stockArea/a.count);close(a.boxUtil,a.cells.length*bodyArea(base)/(base.boxLength*base.boxWidth))});
test('tabs add specified material and reserve physical footprint',()=>{const c={...base,boxLength:1000,boxWidth:700,rows:1,cols:1,rotate:false,multilayer:false,waste:0};const no=pack({...c,tabCount:0},'hex'),yes=pack(c,'hex');assert.equal(no.count,1);assert.equal(yes.count,1);close(yes.cutArea-no.cutArea,c.tabCount*c.tabLength*c.tabWidth);assert.ok(yes.usedLength>no.usedLength);const tooWide=pack({...c,tabLength:1000},'hex');assert.equal(tooWide.count,0)});
test('no fit is explicit and all result scalars remain finite',()=>{for(const kind of ['hex','grid'] as const){const r=pack({...base,boxLength:1},kind);assert.equal(r.count,0);assert.ok(r.reason.includes('無可行'));assert.equal(r.perItem,null);for(const v of Object.values(r))if(typeof v==='number')assert.ok(Number.isFinite(v))}});
test('stack count honors bottle height, safe clearance and outer box height',()=>{const r=pack(base,'grid');assert.equal(r.layers,2);assert.equal(r.count,r.cells.length*2);assert.equal(pack({...base,boxHeight:100},'grid').count,0)});
test('width, height and perimeter control generate mathematically correct candidates',()=>{close(geometry({...base,control:'width',targetWidth:250}).width,250);close(geometry({...base,control:'height',targetHeight:190}).height,190);close(geometry({...base,perimeterCandidate:true,bagPerimeter:700}).perimeter,700)});
test('search includes endpoints and retains all tied objectives without hidden tiebreak',()=>{const c={...base,minAngle:54,maxAngle:58,step:3,rows:1,cols:1,objective:'count' as const};const rs=optimize(c);assert.deepEqual(rs.map(x=>x.theta).sort((a,b)=>a-b),[54,57,58]);const viable=rs.filter(r=>r.count);assert.ok(viable.length>=2);assert.ok(viable.filter(r=>score(r,'count')===score(viable[0],'count')).length>=2)});
test('rounded rectangle analytic support and rotation use correct side lengths',()=>{const c={...base,shape:'rounded' as const,D:100,bodyWidth:60,radius:12,cushion:0,clearance:0,bagLength:1,bagWidth:1};assert.equal(fits(c,rectangle(100,60)),true);assert.equal(fits(c,rectangle(99.99,60)),false);assert.equal(fits(c,rectangle(60,100),true),true);assert.equal(fits(c,rectangle(60,100),false),false)});
test('independent honeycomb wall polygons never overlap',()=>{const c={...base,shared:false};const r=pack(c,'hex');assert.ok(r.count>0);for(let i=0;i<r.cells.length;i++)for(let j=0;j<i;j++)assert.equal(overlaps(inset(r.cells[i].polygon,-c.thickness/2),inset(r.cells[j].polygon,-c.thickness/2)),false);close(r.wallLength,r.cells.length*geometry(c).perimeter)});
test('perimeter estimation falls back to bag dimensions',()=>{const c={...base,perimeterCandidate:true,bagPerimeter:0};close(geometry(c).perimeter,2*(c.bagLength+c.bagWidth))});
test('infeasible candidate search preserves explicit failures and null per-item',()=>{const rs=optimize({...base,bagLength:10000,minAngle:40,maxAngle:50,step:5});assert.equal(rs.length,3);assert.ok(rs.every(r=>r.count===0&&r.perItem===null&&r.reason.includes('無可行')))});
test('gathered envelope uses measured side extension, never the flat bag rectangle',()=>{
 const c={...defaults,D:90,extension:20,bagLength:1000,bagWidth:800};
 const e=envelope(c),b=bounds(e.points);assert.equal(e.known,true);close(e.length,130);close(e.width,90);close(b.minX,-65);close(b.maxX,65);close(b.maxY,45);assert.ok(e.points.length>6);
 close(packageSupport(c,0,1),45);close(packageSupport(c,1,0),65);
});
test('changing only flat bag dimensions cannot alter manually measured gathered packing',()=>{
 const c={...defaults},changed={...c,bagLength:999,bagWidth:777};
 assert.deepEqual(geometry(c),geometry(changed));assert.deepEqual(rectGeometry(c),rectGeometry(changed));
 for(const kind of ['hex','grid'] as const)assert.equal(pack(c,kind).count,pack(changed,kind).count);
});
test('snug honeycomb keeps vertical body clearance constant across all search angles',()=>{
 for(const shape of ['circle','rounded','rectangle'] as const)for(const theta of [20,40,55,70]){
  const c={...defaults,shape,theta},g=geometry(c),inner=inset(g.points,c.thickness/2);
  close(g.height-c.thickness,(shape==='circle'?c.D:c.bodyWidth)+2*(c.cushion+c.clearance));
  assert.equal(fits(c,inner),true,`${shape} ${theta} must fit`);
  const squeezed=inset(inner,0.01);assert.equal(fits(c,squeezed),false,'vertical compression must fail');
 }
});
test('more gathered side extension increases required width without adding vertical space',()=>{
 const c={...defaults,theta:55,extension:25},more={...c,extension:50};
 const a=geometry(c),b=geometry(more);close(a.height,b.height);assert.ok(b.width>a.width);assert.ok(b.a>a.a);
 const ar=rectGeometry(c),br=rectGeometry(more);close(br.length-ar.length,50);close(br.width,ar.width);
});
test('both divider types share the same assembled outline and snug safety margin',()=>{
 const c={...defaults,extension:20,cushion:2,clearance:3};const r=minimumRect(c),g=geometry(c);
 close(r.length,140);close(r.width,100);close(g.height-c.thickness,100);
 assert.equal(fits(c,rectangle(r.length,r.width)),true);assert.equal(fits(c,rectangle(r.length-0.01,r.width)),false);
 assert.ok(pack(c,'hex').count>0);assert.ok(pack(c,'grid').count>0);
});
test('zero side extension retains the circle and rounded-rectangle exact support',()=>{
 const c={...defaults,extension:0,bagLength:0,bagWidth:0};assert.equal(envelope(c).known,true);close(envelope(c).length,c.D);
 close(packageSupport(c,Math.SQRT1_2,Math.SQRT1_2),c.D/2);assert.ok(fits(c,inset(geometry(c).points,c.thickness/2)));
});
test('auto extension is explicitly a candidate based on half flat length excess',()=>{
 const c={...defaults,extensionMode:'auto' as const,bagLength:150,D:90};close(sideExtension(c),30);close(envelope(c).length,150);
 assert.equal(envelope({...c,bagLength:0}).known,false);assert.equal(pack({...c,bagLength:0},'hex').count,0);
});
test('gathered rotated contour swaps side extension onto the other axis',()=>{
 const c={...defaults,D:90,extension:20,cushion:0,clearance:0};
 assert.equal(fits(c,rectangle(90,130)),false);assert.equal(fits(c,rectangle(90,130),true),true);
});
test('legacy JSON preserves fixed CAD and flat-bag assumptions',()=>{
 const legacy:Partial<Config>={...base};delete legacy.packageProfile;delete legacy.snug;
 const c=importConfig({config:legacy});assert.equal(c.packageProfile,'flat');assert.equal(c.snug,false);
 assert.equal(importConfig({config:defaults}).packageProfile,'gathered');assert.equal(importConfig({config:defaults}).snug,true);
});
test('snug angular search recomputes a,s for each angle at the same required height',()=>{
 const c={...defaults,minAngle:30,maxAngle:70,step:10};const rows=optimize(c);assert.equal(rows.length,5);
 assert.ok(rows.every(r=>r.count>0));const a=geometry(c,30),b=geometry(c,70);close(a.height,b.height);assert.notEqual(a.a,b.a);assert.notEqual(a.s,b.s);
});
