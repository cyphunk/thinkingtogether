/*
 * FONT CONTROL BOX
 * 20100827 by Nathan Fain <nathan@squimp.com>
 * Creative Commons Attribution-ShareAlike 3.0 Licensed
 *
 * just include this script and fcMain() will run to setup a
 * #fontcontrol box (div).
 *
 * To selectively load when "#fc" hash added to URL, add this to root
 * document or script:

ref = window.location.href
hash = ref.slice(ref.indexOf('#')+1)
if (hash=='fc')
  document.write('<script type="text/javascript" src="fontcontrol.js"></script>');
 */
boxstyle = 'position:fixed; z-index:1000; margin:5px; right:0; top:0;' +
           'font-family:helvetica,arial; font-size: 9pt; opacity:0.1;';

font = ['Roboto', 'Bungee', 'Source Sans Pro', 'Source Code Pro', 'Railway',
        'Cantarell', 'Cardo', 'Crimson+Text', 'Droid+Sans','Droid+Sans+Mono',
		'Droid+Serif',  'Inconsolata', 'Josefin+Sans+Std+Light',
		'Lobster', 'Molengo', 'Neuton', 'Nobile','OFL+Sorts+Mill+Goudy+TT',
		'Old+Standard+TT', 'Reenie+Beanie', 'Tangerine', 'Vollkorn', 'Yanone+Kaffeesatz'];

console.log('fontcontrol.js load');

curfont = $(document.body).css("font-family").replace(/\'/g, '');
curpt = $(document.body).css("font-size").replace(/\.\d+px/g, '');
function set(fonti, size) {
	if (fonti > 0) {
		$(document.body).css('font-family', font[fonti-1].replace(/\+/gi, ' '));
		$('#curfont').text('font ('+font[fonti-1].replace(/\+/gi, ' ')+')');
		curfont = font[fonti-1];
	}
	if (size > 0) {
		$(document.body).css('font-size',size+'pt');
		$('#curpt').text('size ');
		$('#curpt').append(' <a href="#fc" onclick="set(0,'+(size-1)+')">-</a> <a href="#fc" onclick="set(0,'+(size+1)+')">+</a> ');
		$('#curpt').append('('+size+'pt)');
		curpt = size;
	}
	//setcookie(font,size);
	document.cookie='font='+curfont+'/'+curpt+'';
}
function fcMain() {
	addhtml='';
	if (document.cookie) {
		cookie = document.cookie.split('=')[1].split('/');
		curfont = cookie[0];
		curpt = cookie[1];
		$(document.body).css("font-family", curfont.replace(/\+/gi, " "));//.style.fontFamily=curfont;
		$(document.body).css("font-size",curpt+"pt");
	}

	for (i=0; i<font.length; i++) {
		$(document.head).append("<link href='http://fonts.googleapis.com/css?family="+font[i]+"' rel='stylesheet' type='text/css'>");
		addhtml += '<a href="#fc" onclick="set(' + (i+1) + ', 0)">';
		addhtml += font[i].replace(/\+/ig, " ") + "</a>";
		addhtml += "<br>";
	}
	addhtml += "<br><div id=curpt>size ";
	addhtml += '<a href="#fc" onclick="set(0, '+(parseInt(curpt)-1)+')">-</a> <a href="#fc" onclick="set(0, '+(parseInt(curpt)+1)+')">+</a> ';
	addhtml += "(" + curpt +"pt)</div><br>";

	for (i=10; i<=28; i++) {
		addhtml += "<a href='#fc' onclick='set(0," + i + ")'>" + i +"</a> ";
		if (i%4==1)
			addhtml += "<br>";
	}

	$(document.body).append("<div id=fontcontrol style='"+boxstyle+"'><div id=curfont>font ("+curfont.replace(/\+/ig,"&nbsp;")+")</div><br>"+addhtml+"</div>");
	$("#fontcontrol").hover(function(){$(this).fadeTo(100,1)},function(){$(this).fadeTo(100,0.05)});
}
fcMain();

console.log('fontcontrol.js done loading');
/*
 * END FONT CONTROL BOX
 */
