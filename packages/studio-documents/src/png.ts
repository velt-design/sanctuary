import {deflate} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(deflate);
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(name:string,data:Uint8Array){
 const type=Buffer.from(name),body=Buffer.concat([type,data]);let crc=0xffffffff;
 for(const byte of body)crc=crcTable[(crc^byte)&255]^(crc>>>8);
 const output=Buffer.alloc(data.length+12);output.writeUInt32BE(data.length);body.copy(output,4);output.writeUInt32BE((crc^0xffffffff)>>>0,output.length-4);return output;
}
/** Minimal RGB PNG wire encoding. Compression is asynchronous so lease timers
 * keep running; no native renderer, browser or image package is required. */
export async function encodeRgbPng(width:number,height:number,rgb:Uint8Array){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgb.length!==width*height*3)throw Error('Invalid document raster');
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const rows=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++)rows.set(rgb.subarray(y*width*3,(y+1)*width*3),y*(width*3+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',await compress(rows)),chunk('IEND',Buffer.alloc(0))]);
}
