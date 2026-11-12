import { frameGeometry } from './asset-layout.mjs';
export const WALL_TOP=467,WALL_BOTTOM=1300;
export const isMural=(coins,tier)=>Boolean(coins)&&tier>=3;
export const tierLevel=(coins,tier)=>coins?Math.min(tier+1,6):0;
export const palette=[
 ['#ff188a','#ff77b9','#ffb3d8'],
 ['#fa178b','#09e7ff','#ffdb38'],
 ['#10d7f6','#ff219f','#ffcc45'],
 ['#e51aff','#3997ff','#ffe72e'],
 ['#f313ae','#21d9fb','#ffbe32'],
 ['#00bcff','#f32feb','#ffb446'],
 ['#12ccff','#ff4b20','#ffd251']
];
export function extent(coins,tier,size){
 const {left,right,top,bottom}=frameGeometry(tierLevel(coins,tier),size);
 return {left,right,top,bottom};
}
export function faceRadius(coins,tier,size){
 return frameGeometry(tierLevel(coins,tier),size).radius;
}
