// @module ui.editor
// this sub-module shall contain the whole editor code
woas.ui.editor = {
	_insert_ruler: function() {
		TagThis("\n----\n", "");
	}
};

woas.wiki_buttons_display = function (v) {
	d$('wiki_format_buttons').style.display = v ? 'block' : 'none';
	d$('wiki_format_buttons').style.visibility = v ? 'visible' : 'hidden';
};

woas.html_buttons_display = function (v) {
	d$('html_format_buttons').style.display = v ? 'block' : 'none';
	d$('html_format_buttons').style.visibility = v ? 'visible' : 'hidden';
};

// class for managing textarea selection - by pr0xy
function TextAreaSelectionHelper(obj) {
	this.target=obj;
	this.target.carretHandler=this; // ?
	this.target.onchange=_textareaSaver;
	this.target.onclick=_textareaSaver;
	this.target.onkeyup=_textareaSaver;
	this.target.onfocus=_textareaSaver;
	if(!document.selection)
		this.target.onSelect=_textareaSaver; // ?
 
	this.start=-1;
	this.end=-1;
	this.scroll=-1;
	this.iesel=null;
}

TextAreaSelectionHelper.prototype.getSelectedText=function() {
	if (this.iesel)
		return this.iesel.text;
	// Fixes a problem in FF3 where the selection was not being stored in this.start and this.end when selecting multilines
	this.start = d$("woas_editor").selectionStart;
	this.end = d$("woas_editor").selectionEnd;
	return ((this.start>=0)&&(this.end>this.start))? this.target.value.substring(this.start,this.end): "";
};

TextAreaSelectionHelper.prototype.setSelectedText=function(text, secondtag) {
	if(this.iesel) {
	if(typeof(secondtag)=="string") {
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
   this.target.value=left+text+scont+secondtag+right;
   this.end=this.target.selectionEnd=this.start+text.length+scont.length;
   this.start=this.target.selectionStart=this.start+text.length;    
 } else {
      this.target.value=left+text+right;
   this.end=this.target.selectionEnd=this.start+text.length;
   this.start=this.target.selectionStart=this.start+text.length;
 }
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
	if (document.selection) {
		this.carretHandler.iesel = document.selection.createRange().duplicate();
	} else if(typeof(this.selectionStart)!="undefined") {
		this.carretHandler.start=this.selectionStart;
		this.carretHandler.end=this.selectionEnd;
		this.carretHandler.scroll=this.scrollTop;
	} else
		this.carretHandler.start=this.carretHandler.end = -1;
}

function DivTagThis(align) {
	TagThis('<'+'div align="'+align+'">', '<'+'/div>');
}

function TagThis(starttag, endtag){
	woas._editor.setSelectedText(starttag, endtag);
}

function FullTagThis(tag){
	woas._editor.setSelectedText('<'+tag+'>','<'+'/'+tag+'>');
}

function setUrl(starttag,centertag,endtag) {
	var url=prompt('Link:','http://');
	if (url===null) return;
	var comm=prompt('Link text:','');
	if (comm===null) return;
		woas._editor.setSelectedText(starttag+woas.js_encode(url)+centertag,comm+endtag);
}

function setWikiImage() {
	setImage('[[Include::Image::',']]');
}

function setHTMLImage() {
	setImage('<'+"img src='","' /"+">");
}

function setWikiUrl() {
	setUrl('[[','|',']]');
}

function setWikiIUrl() {
	var url=prompt('Wiki page to link to:','');
	if (url===null) return;
	var comm=prompt('Link text:', url);
	if (comm===null) return;
	if (comm == url)
		woas._editor.setSelectedText('[['+url+']]');
	else
		woas._editor.setSelectedText('[['+url+'|',comm+']]');
}

function setHTMLUrl() {
	setUrl('<'+'a href="','" target="_blank">','<'+'/a>');
}

function setImage(starttag,endtag) {
	var pic=prompt('Image:','');
	if (pic!==null)
		woas._editor.setSelectedText(starttag,woas.js_encode(pic)+endtag);
}

function setTag() {
        var tag=prompt('Set tag:','');
	if (tag!==null)
	woas._editor.setSelectedText("[[Tag::",tag+"]]");
}
