import 'server-only';
import { NextResponse } from 'next/server';
import { outlookPortalOrigin } from './config';
export function calendarJson(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
export function calendarSameOrigin(request:Request){try{return request.headers.get('origin')===outlookPortalOrigin();}catch{return false;}}
