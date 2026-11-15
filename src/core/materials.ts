import type {Point} from './model';
import {wallPieces} from './geometry';
export function materialEstimate(polygons:Point[][],shared:boolean,height:number,layers:number,extras:number,waste:number){
 const pieces=wallPieces(polygons,shared).map(length=>({length,height,quantity:layers,area:length*height*layers}));
 const length=pieces.reduce((sum,p)=>sum+p.length,0),theoretical=length*height*layers,cutArea=theoretical+extras*layers;
 return {pieces,length,theoretical,cutArea,stockArea:cutArea*(1+waste/100)};
}
