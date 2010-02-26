
woas["wiki_buttons_display"] = function (v) {
	$('wiki_format_buttons').style.display = v ? 'block' : 'none';
	$('wiki_format_buttons').style.visibility = v ? 'visible' : 'hidden';
}

woas["html_buttons_display"] = function (v) {
	$('html_format_buttons').style.display = v ? 'block' : 'none';
	$('html_format_buttons').style.visibility = v ? 'visible' : 'hidden';
}

// submitted by pr0xy

function TextAreaSelectionHelper(obj) {
 this.target=obj;
 this.target.carretHandler=this; // ?
 this.target.onchange=_textareaSaver;
 this.target.onclick=_textareaSaver;
 this.target.onkeyup=_textareaSaver;
 this.target.onfocus=_textareaSaver;
// blurring handler disabled until META features are researched more
// this.target.onblur=kbd_blur;
 if(!document.selection) this.target.onSelect=_textareaSaver; // ?
 
 this.start=-1;
 this.end=-1;
 this.scroll=-1;
 this.iesel=null; // ?
}

TextAreaSelectionHelper.prototype.getSelectedText=function() {
	if(this.iesel)
		return this.iesel.text;
	// Fixes a problem in FF3 where the selection was not being stored in this.start and this.end when selecting multilines
	this.start = $("wiki_editor").selectionStart;
	this.end = $("wiki_editor").selectionEnd;
	return (this.start>=0&&this.end>this.start)? this.target.value.substring(this.start,this.end): "";
}

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
}

TextAreaSelectionHelper.prototype.getText=function() {
 return this.target.value;
}
TextAreaSelectionHelper.prototype.setText=function(text) {
 this.target.value=text;
}

function _textareaSaver() {
 if(document.selection) {
   this.carretHandler.iesel = document.selection.createRange().duplicate();
 } else if(typeof(this.selectionStart)!="undefined") {
   this.carretHandler.start=this.selectionStart;
this.carretHandler.end=this.selectionEnd;
this.carretHandler.scroll=this.scrollTop;
 } else {this.carretHandler.start=this.carretHandler.end=-1;}
}

function	DivTagThis(align) {
	TagThis('<div align="'+align+'">', '</div>');
}

function TagThis(starttag, endtag){
	woas._editor.setSelectedText(starttag, endtag);
}

function FullTagThis(tag){
	woas._editor.setSelectedText('<'+tag+'>','</'+tag+'>');
}

// Little Girl (08-18-09): This function was added for special treatment of list line-height:
function FullSpecialTagThis(tag) {
	woas._editor.setSelectedText('<'+tag+' style="line-height:50%;">\n','</'+tag+'>');
}

// Little Girl (08-18-09): This function was added for unusual list types:
function ListTagThis(style) {TagThis('<li style="list-style-type:'+style+';">','</li>\n');}

function setUrl(starttag,centertag,endtag) {
	var url=prompt('Link:','http://');
	if (url===null) return;
	var comm=prompt('Link text:','');
	if (comm===null) return;
		woas._editor.setSelectedText(starttag+woas.js_encode(url)+centertag,comm+endtag);
}

// Little Girl (11-18-09): This function was commented out and replaced with the one below it so it will use the new setImageLocal function to customize the prompt you get when you click the Image button in the editor:
//function setWikiImage() {
//function setWikiImage() {
//	setImage('[[Include::Image::',']]');
//}
function setWikiImage() {setImageLocal('[[Include::Image::',']]');}

// Little Girl (08-18-09) and (11-19-09): This function was commented out and replaced with the one below it to remove the XHTML closing slash:
//function setHTMLImage() {
//	setImage('<img src=\'','\' />');
//}
function setHTMLImage() {setImage('<'+'img src="','">');}

function setWikiUrl() {
	setUrl('[[','|',']]');
}

function setHTMLUrl() {
	setUrl('<a href=\'','\' target=_blank>','</a>');
}

function setImage(starttag,endtag) {
	// Little Girl (11-18-09): I added location to the following line to make it more obvious what you need to type in when you click on the Image link button in the editor:
	var pic=prompt('Image location:','');
	if (pic!==null)
		woas._editor.setSelectedText(starttag,woas.js_encode(pic)+endtag);
}

// Little Girl (11-18-09): This function was added so I could create a customized prompt when the Image button is clicked in the editor:
function setImageLocal(starttag,endtag) {
	var pic=prompt('Image name:','');
	if (pic!==null)
		woas._editor.setSelectedText(starttag,woas.js_encode(pic)+endtag);
}

function setTag() {
        var tag=prompt('Set tag (or tags separated by pipes):','');
	if (tag!==null)
	woas._editor.setSelectedText("[[Tag::",tag+"]]");
}

// Little Girl (10-27-09): I added this section to display an editor Help popup:
function open_editor_help() {
	var w = woas.popup("editorhelp", 575, 380, ",menubar=no,toolbar=no,location=no,status=no,dialog=yes,scrollbars=yes");
	w.document.writeln("<html><head><title>Editor button help<\/title><\/head><body>");
	w.document.writeln("<p><u>Buttons in row 1:<\/u></p>");
	w.document.writeln("<tt><b>Page title:<\/b> Allows you to change the title of the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Delete this page:<\/b> Displays a pop-up on how to delete the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Dictionary:<\/b> Takes you to the Merriam-Webster OnLine Search.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Google:<\/b> Takes you to the Google search engine.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Thesaurus:<\/b> Takes you to Thesaurus.com.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Wikipedia:<\/b> Takes you to Wikipedia.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Help:<\/b> Displays this pop-up.<\/tt><"+"br>");
	w.document.writeln("<p><u>Buttons in row 2:<\/u></p>");
	w.document.writeln("<tt><b>Code:<\/b> Creates a code block, preserving the formatting of the selected text.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Image:<\/b> Includes an embedded image or embeds and includes an image.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Image Link:<\/b> Inserts a linked image from an internet URL.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Indent:<\/b> Indents the selected text as an HTML blockquote.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Line:<\/b> Creates a line or horizontal rule.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Link:<\/b> Creates a labeled link to a URL on the internet.<\/tt><"+"br>");
	w.document.writeln("<tt><b>List *:<\/b> Creates a bulleted list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>List #:<\/b> Creates a numbered list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>List @:<\/b> Creates an alphanumeric list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>More lists @:<\/b> Brings up an additional row of specialty list buttons.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Subscript:<\/b> Places the selected text slightly below the current line.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Superscript:<\/b> Places the selected text slightly above the current line.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Tag:<\/b> Allows you to set a category tag to the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Sort:<\/b> Sorts selected lines of text.<\/tt><"+"br>");
	w.document.writeln("<p><u>Buttons in row 3:<\/u></p>");
	w.document.writeln("<tt><b>Bold:<\/b> Applies bold font to the selected text.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Italic:<\/b> Applies italic font to the selected text.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Underline:<\/b> Applies underline font to the selected text.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Strike:<\/b> Applies strikethrough to the selected text.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Left:<\/b> Aligns the selected text to the left side of the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Center:<\/b> Aligns the selected text to the center of the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Right:<\/b> Aligns the selected text to the right side of the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Justify:<\/b> Justifies the selected text to both sides of the page.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Header 1:<\/b> Converts the selected text into a level 1 header.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Header 2:<\/b> Converts the selected text into a level 2 header.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Header 3:<\/b> Converts the selected text into a level 3 header.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Table:<\/b> Displays a pop-up on how to create tables.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Table of Contents:<\/b> Inserts a Table of Contents into the page.<\/tt><"+"br>");
	w.document.writeln("<p><u>Buttons in optional row 4:<\/u></p>");
	w.document.writeln("<tt><b>&lt;OL&gt;:<\/b> Inserts HTML ordered list tags as a wrapper for custom list items.<\/tt><"+"br>");
	w.document.writeln("<tt><b>&lt;UL&gt;:<\/b> Inserts HTML unordered list tags as a wrapper for custom list items.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Lower Alpha:<\/b> Lower case alphabetical list item (a, b, c).<\/tt><"+"br>");
	w.document.writeln("<tt><b>Upper Alpha:<\/b> Upper case alphabetical list item (A, B, C).<\/tt><"+"br>");
	w.document.writeln("<tt><b>Circle:<\/b> Circle list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Decimal:<\/b> Decimal list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Disc:<\/b> Disc list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Lower Roman:<\/b> Lower Roman list item (i, ii, iii).<\/tt><"+"br>");
	w.document.writeln("<tt><b>Upper Roman:<\/b> Upper Roman list item (I, II, III).<\/tt><"+"br>");
	w.document.writeln("<tt><b>None:<\/b> Plain list item.<\/tt><"+"br>");
	w.document.writeln("<tt><b>Square:<\/b> Square list item.<\/tt><"+"br>");
	w.document.writeln("<\/body><\/html>");
	w.document.close();
}
