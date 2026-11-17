export type Point = { x: number; y: number };
export type Shape = 'circle' | 'rounded' | 'rectangle';
export type Objective = 'count' | 'material' | 'volume';
export type Config = {
  packageProfile:'gathered'|'flat'; snug:boolean;
  D:number; T:number; bodyWidth:number; radius:number; shape:Shape;
  bagLength:number; bagWidth:number; bagPerimeter:number; perimeterCandidate:boolean;
  extensionMode:'auto'|'manual'; extension:number; cushion:number; clearance:number;
  a:number; s:number; theta:number; control:'angle'|'width'|'height'; targetWidth:number; targetHeight:number;
  thickness:number; height:number; extraArea:number; returnArea:number; tabLength:number; tabWidth:number; tabCount:number;
  rows:number; cols:number; offset:number; shared:boolean; waste:number;
  rectLength:number; rectWidth:number; rectThickness:number; rectHeight:number; rectHorizontal:number; rectVertical:number; rectExtra:number;
  boxLength:number; boxWidth:number; boxHeight:number; boxGap:number; rotate:boolean; multilayer:boolean;
  minAngle:number; maxAngle:number; step:number; objective:Objective;
};
export const defaults:Config={packageProfile:'gathered',snug:true,D:90,T:180,bodyWidth:72,radius:15,shape:'circle',bagLength:140,bagWidth:96,bagPerimeter:0,perimeterCandidate:false,extensionMode:'manual',extension:25,cushion:2,clearance:2,a:110,s:100,theta:55,control:'angle',targetWidth:180,targetHeight:120,thickness:3,height:190,extraArea:120,returnArea:0,tabLength:12,tabWidth:35,tabCount:4,rows:12,cols:12,offset:0.5,shared:true,waste:10,rectLength:148,rectWidth:104,rectThickness:3,rectHeight:190,rectHorizontal:11,rectVertical:11,rectExtra:120,boxLength:600,boxWidth:450,boxHeight:410,boxGap:5,rotate:true,multilayer:true,minAngle:20,maxAngle:70,step:2,objective:'count'};
export function validate(c:Config):string[]{
 const errors:string[]=[];
 for(const [key,value] of Object.entries(defaults)) if(typeof value==='number'){
  const v=c[key as keyof Config]; if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000) errors.push(`${key} 必須為 0 至 1,000,000 的有限數值`);
 }
 for(const k of ['D','T','a','s','height','rectLength','rectWidth','rectHeight','boxLength','boxWidth','boxHeight','step','rows','cols'] as const) if(c[k]<=0) errors.push(`${k} 必須大於 0`);
 if(c.theta<=0||c.theta>=90||c.minAngle<=0||c.maxAngle>=90||c.minAngle>c.maxAngle) errors.push('角度必須介於 0° 與 90°，且下限不可大於上限');
 if(c.offset>1) errors.push('錯位比例必須介於 0 與 1');
 if(c.waste>100) errors.push('損耗率不得超過 100%');
 for(const k of ['rows','cols','tabCount','rectHorizontal','rectVertical'] as const) if(!Number.isInteger(c[k])) errors.push(`${k} 必須為整數`);
 if(c.rows>40||c.cols>40||c.rectHorizontal>39||c.rectVertical>39) errors.push('即時規則搜尋上限為每軸 40 格');
 if((c.maxAngle-c.minAngle)/c.step>250) errors.push('角度搜尋最多 251 組，請增加間隔');
 if(c.shape!=='circle'&&c.bodyWidth<=0) errors.push('長方形本體寬度必須大於 0');
 if(!['circle','rounded','rectangle'].includes(c.shape)||!['angle','width','height'].includes(c.control)||!['count','material','volume'].includes(c.objective)||!['auto','manual'].includes(c.extensionMode)) errors.push('不支援的選項');
 if(!['gathered','flat'].includes(c.packageProfile))errors.push('不支援的包裝輪廓');
 for(const k of ['shared','rotate','multilayer','perimeterCandidate','snug'] as const) if(typeof c[k]!=='boolean') errors.push(`${k} 必須為布林值`);
 return errors;
}
export function importConfig(data:unknown):Config{
 if(!data||typeof data!=='object') throw Error('設定格式錯誤');
 const obj=data as Record<string,unknown>; const source=(obj.config??obj) as Record<string,unknown>;
 const c={...defaults}; for(const k of Object.keys(defaults) as (keyof Config)[]) if(k in source) Object.assign(c,{[k]:source[k]});
 // Legacy exports described a flat rectangular bag and fixed CAD dimensions.
 if(!('packageProfile' in source))c.packageProfile='flat';
 if(!('snug' in source))c.snug=false;
 const e=validate(c); if(e.length) throw Error(e.join('；')); return c;
}
