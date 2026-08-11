/**
 * Curated list of common multi-segment public suffixes.
 * This is a subset of the full Public Suffix List (PSL).
 * 
 * We use this to correctly identify the "registrable domain" 
 * (e.g., 'google.co.uk' instead of 'co.uk').
 */
export const MULTI_SEGMENT_SUFFIXES = [
    'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'gov.uk', 'mod.uk', 'nhs.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
    'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'art.br', 'dev.br',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
    'co.jp', 'ne.jp', 'or.jp', 'go.jp', 'ac.jp', 'ad.jp', 'ed.jp', 'lg.jp',
    'com.mx', 'net.mx', 'org.mx', 'edu.mx', 'gob.mx',
    'com.ru', 'net.ru', 'org.ru',
    'co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr', 'mil.kr', 'ac.kr',
    'co.id', 'net.id', 'or.id', 'go.id', 'ac.id', 'my.id', 'biz.id',
    'com.tw', 'net.tw', 'org.tw', 'edu.tw', 'gov.tw',
    'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn',
    'me.com', 'us.com', 'uk.com', 'eu.com', 'de.com', 'jpn.com', 'br.com', 'cn.com', 'sa.com', 'la.com', 'ru.com',
    'africa.com', 'gr.com', 'hu.com', 'no.com', 'qc.com', 'uy.com', 'za.com',
    'co.za', 'net.za', 'org.za', 'web.za',
    'k12.il.us', 'k12.ny.us', 'k12.ca.us', 'k12.tx.us', // Example US state-level
    'github.io', 'gitlab.io', 'herokuapp.com', 'netlify.app', 'vercel.app', 'azurewebsites.net', 'cloudfunctions.net',
    's3.amazonaws.com', 's3-website.amazonaws.com'
];
