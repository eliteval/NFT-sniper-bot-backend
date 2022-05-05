const fs = require('fs');
const fsPromise = require("fs").promises;
function diffTwoDate(date1, date2){
    var date1= new Date(date1);
    var date2= new Date(date2);
    var diff= (date2.getTime()-date1.getTime())/(1000 * 3600 * 24);
    return diff;
}
function timeDeltaToDate(delta) {
    let str = '';
    const day = Math.floor(delta / 24 / 60 / 60 / 1000);
    const hour = Math.floor((delta % (24 * 60 * 60 * 1000)) / 60 / 60 / 1000);
    const minute = Math.floor((delta % (60 * 60 * 1000)) / 60 / 1000);
    const seconds = Math.floor(delta % (60 * 1000)/1000);
    if (day > 0) str += day + 'days ';
    if (hour > 0) str += hour + 'h ';
    if (minute > 0) str += minute + 'min ';
    if (seconds > 0) str += seconds + 's ';
    return str;
  }
function strftime(ss,format) {
    const getFormat = (text) => {
        if (text < 10) return '0' + text
        else return text;
    }
    const d = new Date(ss);
    if(format=='YYYY-mm-dd hh:mm:ss'){
        const dateFormat = d.getFullYear() + '-' + getFormat(d.getMonth() + 1) + '-' + getFormat(d.getDate()) + ' ' + getFormat(d.getHours()) + ':' + getFormat(d.getMinutes()) + ':' + getFormat(d.getSeconds());
        return dateFormat;
    }
    else if(format=='hh:mm:ss'){
        const hour = Math.floor(ss / 3600) < 10 ? '0' + Math.floor(ss / 3600) : Math.floor(ss / 3600);
        const minute = Math.floor((ss % 3600) / 60) < 10 ? '0' + Math.floor((ss % 3600) / 60) : Math.floor((ss % 3600) / 60);
        const second = ss % 60 < 10 ? '0' + ss % 60 : ss % 60;
        return '' + hour + ':' + minute + ':' + second;
    }
    else{
        const dateFormat = d.getFullYear() + '-' + getFormat(d.getMonth() + 1) + '-' + getFormat(d.getDate()) + ' ' + getFormat(d.getHours()) + ':' + getFormat(d.getMinutes()) + ':' + getFormat(d.getSeconds());
        return dateFormat;
    }
}  
function utcToChina(time) {
    if(!time) return ''
    const date = new Date(time)
    return strftime(date.setHours(date.getHours()+8),"YYYY-mm-dd hh:mm:ss")
}
function formatBytes(x) {
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let l = 0, n = parseInt(x, 10) || 0;

    while(n >= 1024 && ++l){
        n = n/1024;
    }
    //include a decimal point and a tenths-place digit if presenting 
    //less than ten of KB or greater units
    return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}
//file
const existFile = (path) => {
   return fs.existsSync(path)  
}
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() *
        charactersLength));
    }
    return result;
}
function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}
module.exports = {
    formatBytes,
    timeDeltaToDate,
    strftime,
    existFile,
    utcToChina,
    diffTwoDate,
    sleep,
    makeid,
};
  