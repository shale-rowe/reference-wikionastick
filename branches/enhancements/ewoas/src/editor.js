// @module ui.editor
// this sub-module shall contain the whole editor code
woas.ui.editor = {
	// make e$._insert_ruler() instead of onclick="woas.ui.editor._insert_ruler()" 
	_insert_ruler: function() {
		TagThis("\n----\n", "");
	},
	promptIf: function(q,v){
		if(woas._editor.getSelectedText())return "";
		return prompt(q,v||'');	
	},
	setImage: function(starttag,endtag) {
		var pic=this.promptIf('Image:');
		if (pic===null)return;
		woas._editor.setSelectedText(starttag,woas.js_encode(pic)+endtag);
	},
	setTag: function() {
		var tag=this.promptIf('Set tag:');
		if (tag===null)return;
		woas._editor.setSelectedText("[[Tag::",tag+"]]");
	},
	setWikiImage: function() {
		this.setImage('[[Include::Image::',']]')
	},
	setHTMLImage: function() {
		this.setImage('<'+"img src='","' /"+">")
	},
	setUrl: function(starttag,centertag,endtag) {
		var url=this.promptIf('Link:','http://');
		if (url===null) return;
		var comm=prompt('Link text:','');
		if (comm===null) return;
			woas._editor.setSelectedText(starttag+woas.js_encode(url)+centertag,comm+endtag);
	},
	setHTMLUrl: function() {
		this.setUrl('<'+'a href="','" target="_blank">','<'+'/a>');
	},
	setWikiUrl: function() {
		this.setUrl('[[','|',']]');
	},
	setWikiIUrl: function() {
		var space="";
		var url=prompt('Wiki page to link to:',woas._editor.getSelectedText().replace(/(\s+)$/, function (str, $1) {space += $1; return ""}));
		if (url===null) return;
		var txt=prompt('Link text:', url);
		if (txt===null) return;
		woas._editor.setSelectedText('[['+url + ((txt==url || !txt)?'':'|'+txt) + ']]'+space);
	}


};

woas.buttons_display = function (id,v) {
	if(v===undefined)
		v = d$(id).style.display != 'block'
	d$(id).style.display = v ? 'block' : 'none';
	d$(id).style.visibility = v ? 'visible' : 'hidden';
};

// class for managing textarea selection - by pr0xy
function TextAreaSelectionHelper(obj) {
	this.target=obj;
	this.target.carretHandler=this; // ?
	this.target.onchange=_textareaSaver;
	this.target.onclick=_textareaSaver;
	this.target.onkeyup=_textareaSaver;
	this.target.onfocus=_textareaSaver;
	this.target.onblur=woas.ui.kbd_blur;
	if(!document.selection)
		this.target.onSelect=_textareaSaver; // ?
 
	this.start=-1;
	this.end=-1;
	this.scroll=-1;
	this.iesel=null;
}

TextAreaSelectionHelper.prototype.getSelectedText=function() {
	if(this.iesel)
		return this.iesel.text;
	// Fixes a problem in FF3 where the selection was not being stored in this.start and this.end when selecting multilines with mouse (still happens)
	this.start = d$("woas_editor").selectionStart;
	this.end = d$("woas_editor").selectionEnd;
	return ((this.start>=0)&&(this.end>this.start))? this.target.value.substring(this.start,this.end): "";
};

TextAreaSelectionHelper.prototype.setSelectedText=function(text, secondtag,multilines) {
	if(this.iesel) {
	if(typeof(secondtag)=="string") {
		if(multilines&&this.iesel.text.match(/\n/)){
			var R=new Array();
			this.iesel.text.split("\n").forEach(function(s){ s=s.replace(/(.*)(\s*)$/, text+"$1"+secondtag+"$2");R.push(s)});
			this.iesel.text=R.join("\n");
		}else
			this.iesel.text = this.iesel.text.replace(/(\s+)$/, function (str, $1) {secondtag += $1; return ""}); 
//		alert("T=("+this.iesel.text+")$1=("+$1+")"+$secondtag) // TODO TEST IN IE8 and IE9
		var l=this.iesel.text.length;
		this.iesel.text=text+this.iesel.text+secondtag;
		this.iesel.moveEnd("character", -secondtag.length);
		this.iesel.moveStart("character", -l);   
	} else {
	  this.iesel.text=text;
	}
	this.iesel.select();
 } else if(this.start>=0&&this.end>=this.start) {
    var left=this.target.value.substring(0,this.start);
    var right=this.target.value.substr(this.end);
	var scont=this.target.value.substring(this.start, this.end);
	if(typeof(secondtag)=="string") {
		if(multilines&&scont.match(/\n/)){
			var R=new Array();
			scont.split("\n").forEach(function(s){ s=s.replace(/(.*)(\s*)$/, text+"$1"+secondtag+"$2");R.push(s)});
			scont=R.join("\n");
		}else
			scont = text+ scont.replace(/(\s+)$/, function (str, $1) {secondtag += $1; return ""})+secondtag; 
		this.target.value=left+scont+right;
		this.start -= text.length;
		this.end=this.target.selectionEnd=this.start+text.length+scont.length;
	} else {
		this.target.value=left+text+right;
		this.end=this.target.selectionEnd=this.start+text.length;
	}
	this.start=this.target.selectionStart=this.start+text.length;
	this.target.scrollTop=this.scroll;
	this.target.focus();
 } else {
   this.target.value+=text + ((typeof(secondtag)=="string")? secondtag: "");
   if(this.scroll>=0) this.target.scrollTop=this.scroll;
 }
};

TextAreaSelectionHelper.prototype.getText=function() {
	return this.target.value;
};

TextAreaSelectionHelper.prototype.setText=function(text) {
	this.target.value=text;
};

function _textareaSaver() {
	if(document.selection) {
		this.carretHandler.iesel = document.selection.createRange().duplicate();
	} else if(typeof(this.selectionStart)!="undefined") {
		this.carretHandler.start=this.selectionStart;
		this.carretHandler.end=this.selectionEnd;
		this.carretHandler.scroll=this.scrollTop;
	} else
		this.carretHandler.start=this.carretHandler.end = -1;
}

function TagThis(starttag, endtag, multilines){
	woas._editor.setSelectedText(starttag, endtag, multilines);
}
function FullTagThis(tag,prop,value,multilines){
	var pv = prop? ' '+(value? prop+'="'+value+'"' : prop) : '';
	woas._editor.setSelectedText('<'+tag+pv+'>','</'+tag+'>',multilines);
}

// this function was added by Little Girl for unusual list types
function ListTagThis(style,multilines) {
	FullTagThis('li','style','list-style-type:'+style,multilines);
}

function AddThis(starttag, endtag,multilines){
	if(starttag)
		woas._editor.setSelectedText(starttag+woas._editor.getSelectedText(), endtag,multilines);
	else
		woas._editor.setSelectedText(starttag,woas._editor.getSelectedText()+endtag,multilines);
}






woas.ui.button = new Array();
woas.ui.button.META = -1; // need to call setMETA(0) for first time initialization
woas.ui.button.make = function(name, label, description, onclick) {
  return {"name":name,"label":label,"desc":description,"onclick":onclick}
} 

woas.ui.button.set = function(n,meta,b) {
	woas.ui.button[n+meta*16] = b;
}
woas.ui.button.get = function(n,meta,b) {
	return woas.ui.button[n+meta*16] ? woas.ui.button[n+meta*16] : (b?b:this.make());
}

woas.ui.button.setMETA = function(meta) {
	if(this.META==meta) return;
	this.META=meta;
	var b; var j=d$('pb0')?16:-1; var id;
	while(j-->0){
		b=this.get(j,meta);
		if(b==undefined||!b.name) b=this.make('n/a',"","undefined",undefined);
		id="pb"+j;
		d$(id).value = b.label;
		d$(id).title = b.desc;
		d$(id).onclick = b.onclick;
	}
}
woas.ready( function(){ woas.ui.button.setMETA(0)} ); // Delay execution until all editor buttons are loaded.

WUB=woas.ui.button;
WUB.set(0,0, WUB.make("TOC", "TOC", "Table of Content", function(){TagThis("[[Special::TOC]]")} ))
WUB.set(0,1, WUB.make("sig", "sig", "signature", function(){woas._editor.setSelectedText("<br/>kind regards,<br/>The *WOAS* team.");} ))
WUB.set(1,0, WUB.make("note", "note", "gray-boxed text", function(){FullTagThis("div", "class=\"text_area\""); } ))
WUB.set(1,1, WUB.make("mark", "marker", "highlight", function(){FullTagThis("span", "class=\"woas_search_highlight\"");} ))
WUB.set(2,0, WUB.make("sort", "sort", "sort", function(){woas._editor.setSelectedText( woas._editor.getSelectedText().split("\n").sort().join("\n"));} ))
WUB.set(2,1, WUB.make("t2t", "tab |", "tab2table", function(){woas._editor.setSelectedText( woas._editor.getSelectedText().replace(/\t/g," || "));} ))
WUB.set(2,2, WUB.make("rw", "rewrap", "rewrap", function(){woas._editor.setSelectedText( woas._editor.getSelectedText().replace(/\-\s*\n/g, '').replace(/:\s*\n/g, ':#CR#').replace(/\n\n+/g, '#CR##CR#').replace(/\n/g, ' ').replace(/  /g, ' ').replace(/#CR#/g, '\n')); } ))
WUB.set(3,0, WUB.make("c", "Center", "Align selection center", function(){FullTagThis('div','align','center')} ))
WUB.set(3,1, WUB.make("l", "Left", "Align selection left", function(){FullTagThis('div','align','left')} ))
WUB.set(3,2, WUB.make("r", "Right", "Align selection right", function(){FullTagThis('div','align','right')} ))
WUB.set(3,3, WUB.make("j", "Justify", "Align selection justify", function(){FullTagThis('div','align','justify')} ))
WUB.set(3,0, WUB.make("~", "Tilde", "No wiki", function(){TagThis('~')} ))

// TODO: toupper to lower and Camel

WUB.set(5,0, WUB.make("color", "color", "select/set color", 
	function(){if(woas._editor.getSelectedText()){FullTagThis('font', 'color='+Colorizer.rgb);}else{Colorizer.pick('pb5', "Colorizer.getObj('pb5').style.backgroundColor=Colorizer.rgb")}} ))
WUB.set(6,0, WUB.make("qq", '"', "Real Quotes", function(){TagThis(String.fromCharCode(8220), String.fromCharCode(8221));} )) // could also have used: "&#8221;"
WUB.set(6,1, WUB.make("cit", '...', "Citation", function(){TagThis(",,", "''");} ))
WUB.set(6,2, WUB.make("macro", "<<<>>>", "Macro", function(){TagThis(String.fromCharCode(171).repeat(3), String.fromCharCode(187).repeat(3));} ))

WUB.set(9,0, WUB.make("ol", "<OL>", "Ordered list", function(){FullTagThis('ol', 'style', "line-height:50%;",1)} ))
WUB.set(9,1, WUB.make("ul", "<UL>", "Unordered list", function(){FullTagThis('ul', 'style', "line-height:50%;",1)} ))
WUB.set(10,0, WUB.make("Circle", "Circle", "Circle list item", function(){ListTagThis('circle',1)} ))
WUB.set(10,1, WUB.make("Disc", "Disc", "Disc list item", function(){ListTagThis('disc',1)} ))
WUB.set(11,0, WUB.make("a", "alpha", "Lower alpha list item", function(){ListTagThis('lower-alpha',1)} ))
WUB.set(11,1, WUB.make("A", "ALPHA", "Lower alpha list item", function(){ListTagThis('upper-alpha',1)} ))
WUB.set(11,2, WUB.make("Ar", "armenian", "Armenian list item (Firefox only)", function(){AddThis('@{armenian} ',1)} ))
WUB.set(12,0, WUB.make("r", "roman", "Lower Roman list item", function(){ListTagThis('lower-roman',1)} ))
WUB.set(12,1, WUB.make("R", "ROMAN", "Upper Roman list item", function(){ListTagThis('upper-roman',1)} ))
WUB.set(12,2, WUB.make("r2", "roman2", "Lower Roman list item (wiki syntax)", function(){AddThis('@{lower-roman} ',1)} ))




Colorizer = { 
	divSet: false,
	rgb: undefined,
	dad: undefined,
	set: undefined,
	onchange: undefined,

	getObj: function(id) {return document.all ? document.all[id] : document.getElementById(id);}, // AKA d$()

	setColor: function(color) {
		var picker = this.getObj('colorpicker');
		this.rgb = color;
		if(this.set){ eval(this.set);}
		if(this.onchange){ this.onchange();}
		picker.style.display = 'none';
		picker.innerHTML = "";
		delete picker.parentNode.removeChild(picker);
	},

	pick: function(id, set,onchange) {
		this.set = set;
		this.onchange = onchange;
		if (!this.getObj('colorpicker')) {
			if (!document.createElement)
				return;
			var elemDiv = document.createElement('div');
			if (typeof(elemDiv.innerHTML) != 'string')
				return;
			document.body.appendChild(elemDiv);
			elemDiv.id = 'colorpicker';
			elemDiv.style.position = 'absolute';
			elemDiv.style.display = 'none';
			elemDiv.style.border = '#000 1px solid';
			//elemDiv.style.opacity: 0.75;
			//elemDiv.style.background = '#FFF';
		}

		var picker = this.getObj('colorpicker'); 
		picker.innerHTML = Colorizer.colorBox();

		//alert('picker='+picker);
		if (id == Colorizer.dad && picker.style.display == 'block') {
			picker.style.display = 'none';
			picker.innerHTML = "";
			return;
		}

		Colorizer.dad = id;
		var o = this.getObj(id);
		var P=this.findPos(o);
		picker.style.left = P.left+'px'; 
		picker.style.top = P.top+'px'; 
		//picker.style.bottom= 0;
		//picker.style.right= "50px";
		picker.style.zIndex =1;
		picker.style.display = 'block';
	},

	colorBox: function() {
		// Generate Colours
		var CC = [];
		var C = ['0', '3', '6', '9', 'C', 'F'];
		 for (var a = 0, c=0; a < C.length,c = C[a]; ++a)
			CC.push('#'+c+c+c, '#00'+c, '#0'+c+'0', '#'+c+'00', '#0'+c+c, '#'+c+'0'+c, '#'+c+c+'0');
		 CC.splice(1,6, 'MediumBlue', 'SeaGreen', 'OrangeRed', 'SpringGreen', 'Crimson', 'SaddleBrown');
		// table
		var cc = '<table cellspacing="0"><tr>';
		for (var i = 0; i < CC.length; i++) {
			i % 7 || (cc += '<tr/><tr>');
			cc += '<td bgcolor="#000"><a style="outline: 1px solid; color: ' + CC[i] + '; background: ' + CC[i] + ';" title="' + CC[i] + '" href="javascript:Colorizer.setColor(\'' + CC[i] + '\');">__</a></td>';
		}
		cc += '</tr></table>';
		return cc;
	},

	findPos: function(obj) {
		var o = obj;
		var _left = _top = 0;
		if (o.offsetParent) {
			do {
				_left += o.offsetLeft;
				_top += o.offsetTop;
			} while (o = o.offsetParent);
			_top += obj.offsetBottom? obj.offsetBottom : 25; //margin-top 
			//alert('findPos left='+_left+" top="+_top);
			return {left:_left,top:_top};
		}
	}

}

