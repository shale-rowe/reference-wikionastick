woas["parser"] = {
	"has_toc":null,
	"toc":"",
	"force_inline":false,		// used not to break layout when presenting search results
	"script_extension":[]	// external javascript files to be loaded
};

woas.parser["header_anchor"] = function(s) {
	// apply a hard normalization
	// WARNING: will not preserve header ids uniqueness
	return s.replace(/[^a-zA-Z0-9]/g, '_');
}

// var reParseOldHeaders = /(^|\n)(\!+)\s*([^\n]+)/g;
var reParseHeaders = /(?:^|\n)(=+|\!+)[ \t](?:([^\n]+)[ \t]\1|([^\n]+))/g;
woas.parser["header_replace"] = function(str, $1, $2, $3) {
		header = $2 || $3;
		// automatically build the TOC if needed
		var len = $1.length;
		if (woas.parser.has_toc) {
			woas.parser.toc += "#".repeat(len)+" <a class=\"link\" href=\"#" +
			woas.parser.header_anchor(header) + "\">" + header + "<\/a>\n";
		}
		return "</div><h"+len+" id=\""+woas.parser.header_anchor(header)+"\">"+header+"</h"+len+"><div class=\"level"+len+"\">";
}

woas.parser["sublist"] = function (s) {   
	var A=s.replace(/\\\\\n/, "<br/>").split(/\n/);
	var firstline = A.shift();
	var fl= "";
	var close="";
	firstline=firstline.replace(/^((?:\*|#|@[ia1#\*]?)+)[ \t](.*)$/i,
			function(str,a,b,c){
					fl=a;
					var open="";
					if(a == '*'||a=='@*'){
						open="<ul>"; close="</ul>"
					}else{
						open="<ol>"; close="</ol>"
						var w = a.split("");
						if(w[1] || a=='@')
							open="<ol TYPE=\""+(w[1]||'a')+"\">";
					}
					return open+"<li>"+b;
	});
	
	// Search for brothers and children
	while(A.length>0){
		var CHILD= "";
		if(A[0] == ""){
			// firstline += "</li>";
			A.shift();
		}else if(!A[0].replace(fl,"").match(/^(?:\*|#|@[ia1#\*]?)/i)){
			firstline += "<li>" + A.shift().replace(fl,"");
		}else{
			while (A.length>0 && A[0].replace(fl,"").match(/^(?:\*|#|@[ia1#\*]?)/i)) {
				CHILD += A.shift().replace(fl,"")+"\n";
			}
			if(CHILD)
				// firstline += "</li>"+this.sublist(CHILD);
				firstline += this.sublist(CHILD);
		}
	}
	return firstline+close;
}

// XHTML lists and tables parsing.  Original code by plumloco.
// This is a bit of a monster, if you know an easier way please tell me!
// There is no limit to the level of nesting and it produces
// valid xhtml markup. text=text.replace(reReapLists, this.parse_lists);
/*
type=* item=level1 <!-- #CTUugobt::0 --> $2=
*# level2-2 <!-- #CTUugobt::2 --> $3=# $4=16 str=
* level1 <!-- #CTUugobt::0 -->
*# level2-1 <!-- #CTUugobt::1 -->
*# level2-2 <!-- #CTUugobt::2 -->
*/
var reReapLists = /^(?:\*|#|@[iIaA1#\*]?)[ \t].*(?:(?:\n)(?:\*|#|@[iIaA1#\*]?)+[ \t][^\n]+)*$/gm;
woas.parser["parse_lists"] = function(str) {
 return woas.parser.sublist(str);
}


var reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm;
woas.parser["parse_tables"] =  function (str, p1) {
	var caption = '';
	var stk = [];
	p1.replace( /\n\|([+ -])(.*)/g, function(str, pp1, pp2) {
		if (pp1 == '-') // currently a remark, but could be used for meta information in the future
			return;
		if (pp1 == '+'){ // set the caption
			caption = caption || ('<caption' + (stk.length>0? ' style="caption-side:bottom">':'>') + pp2+ '</caption>');
			return;
		}
		var cells = pp2.replace(/\|\|\s*\|\|/g,"||  ||").replace(/(^\s)|(\s$)/, '').split(/\s\|\|\s?/);
		var row = [];       // table row
		var stag = "";      // start tag
		var cs = 0;         // counter for spanned columns
		for (var i=cells.length - 1; i >= 0; --i){
			var C = cells[i].match(/^(\s*)(=\s*)?(.*?)(\s*)$/);
		   if (i && !C[3]) { // if empty and not first column, increase span counter.
				++cs;
				continue;
			}
			stag = '<'+ (C[2]?'th':'td') + (cs? ' colspan=' + ++cs : '') + (C[1]?' align='+(C[4]? 'center':'right'):'') + '>';
			cs = 0;
			row.unshift( stag + C[3] + (C[2]?'</th>':'</td>') );
		}
		stk.push(row.join(""));
		}
	);
	return  '<table class="text_area">'
		+ caption
		+ '<tr>' + stk.join('</tr><tr>') + '</tr>'
		+ '</table>'
}


// remove wiki and html that should not be viewed when previewing wiki snippets
// woas["xhtml_encode"]
function _filter_wiki(s,mode) {
	if(mode){
		var A = [];
		return s.replace(/([\{<]{3}[\s\S]*?[\}>]{3})/g, 
			function (str, $1) { A.push($1); return "{_%%_}"; }
			).replace(/\<\/?\w+\s*[^>]*>/g, "").replace(/{_%%_}/g, A.shift());
	}else
		return s.replace(/[\{<]{3}([\s\S]*?)[\}>]{3}/g, "").
			replace(/\<\/?\w+\s*[^>]*>/g, "");
};


// THIS is the method that you should override for your custom parsing needs
// text is the raw wiki source
// export_links is set to true when exporting wiki pages and is used to generate proper href for hyperlinks
// js_mode can be 0 = leave script tags as they are (for exporting), 1 - place script tags in <head /> (dynamic),
//		2 - re-add script tags after parsing
woas.parser["parse"] = function(text, export_links, js_mode, title) {
	if (this.debug) {
		if (text===null)
			log("Called parse() with null text!");	// log:1
		return null;
	}
	// default fallback
	if (typeof export_links == "undefined") {
		export_links = false;
		js_mode=1;
	}
	if(title && typeof(woas["before_parser"])=='function')
		text = woas["before_parser"](text,title);

	// this array will contain all the HTML snippets that will not be parsed by the wiki engine
	var html_tags = [];

	// thank you IE, really thank you
	if (ie)
		text = text.replace("\r\n", "\n");
		
	// put away stuff contained in inline nowiki blocks {{{ }}}
	text = text.replace(/\{\{\{(.*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<tt class=\"wiki_preformatted\">"+woas.xhtml_encode($1)+"</tt>");
		return r;
	});

	// Escape wiki
	text = text.replace(/~([^\nA-Za-z0-9])/g, "<!-- -->$1<!-- -->");
	
	// put away code contained in single-line "emphasized paragraph" blocks [[[ ]]]  and ,,polish-quotes'' (was before: &#12300; or \u300C &#12301; or \u300D)
	text = text.replace(/(\[{3}|,,)(.*?)(\]{3}|'')/g, function (str, $1, $2) {
		var t = $1=='[[['?'span':'q';
		return "<"+t+" class=\""+($1=='[[['?'note':'citation')+"\">"+$2+"</"+t+">";
		// var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		// html_tags.push("<"+t+" class=\""+($1=='['?'note':'citation')+"\">"+$2+"</"+t+">");
		// return r;
	});
	
	// transclusion code - originally provided by martinellison
	if (!this.force_inline) {
		var trans_level = 0;
		do {
			var trans = 0;
			text = text.replace(/\[\[(Include::|\$\$)([^\]]+)\]\]/g, function (str, $1, $2) {
				var parts = woas.parse_alias($1[0]=='$'? '$'+$2:$2).split("|");
				var templname = parts[0];
// alert("Transcluding "+templname+"("+parts.slice(0).toString()+")"); // NILTON
				log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:1
				var templtext = woas.get_text_special(templname);
				if (templtext == null) {
					var templs="[["+templname+"]]";
					if (parts.length>1)
						templs += "|"+parts.slice(1).join("|");
					return "[<!-- -->[Include::"+templs+"]]";
				}
				// in case of embedded file, add the inline file or add the image
				if (!woas.is_reserved(templname) && woas.is_embedded(templname)) {
					var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
					log("Embedded file transclusion: "+templname);	// log:1
					if (woas.is_image(templname)) {
						var img, img_name = woas.xhtml_encode(templname.substr(templname.indexOf("::")+2));
						var p = parts.length>1? parts.slice(1).join(" ") : "";
						img = "<img class=\"embedded\" src=\""+ (export_links? woas._export_get_fname(templname)+"\" alt=\""+img_name : templtext) +"\" "+p;
						if (parts.length>1) {
							img += parts[1];
							// always add the alt attribute to images
							if (!export_links && !parts[1].match(/alt=('|").*?\1/))
								img += " alt=\""+img_name+"\"";
						}
						html_tags.push(img+" />");
					} else { // embedded file but not image
						if ((parts.length>1) && (parts[1]=="raw"))
							html_tags.push(decode64(templtext));
						else
							html_tags.push("<pre class=\"embedded\">"+
									woas.xhtml_encode(decode64(templtext))+"</pre>");
					}
					templtext = r;
				} else { // wiki source transclusion
					parts[0]=title; // %0 is the pagename that called the transclusion
					templtext = templtext.replace(/%(\d+)/g, function(param, paramno) {
						if(parseInt(paramno) >= parts.length)
							return param; // No parameter, don't replace
						else{
							// if we did %01 instead of %1 we want to parse a multiline parameter with \n replaced as <br>.
							if ("0"+parseInt(paramno) == paramno)
								return parts[parseInt(paramno)].replace(/\n/g, "<br>");
							return parts[parseInt(paramno)];
						}
					} );
				}
				trans = 1;
				return templtext;	
			});
			// keep transcluding when a transclusion was made and when transcluding depth is not excessive
		} while (trans && (++trans_level < 16));
		if (trans_level == 16) // remove Include:: from the remaining inclusions
			text = text.replace(/\[\[(?:Include::|\$\$)([^\]\|]+)(\|[\]]+)?\]\]/g, "[<!-- -->[Include::[[$1]]$2]]");
	}

	var tags = [];
	
	// put away raw text contained in multi-line nowiki blocks {{{ }}}    http://blog.stevenlevithan.com/archives/singleline-multiline-confusing
	text = text.replace(/\{\{\{([\s\S]*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<pre class=\"wiki_preformatted\">"+woas.xhtml_encode($1)+"</pre>");
		return r;
	});

	// put away stuff contained in user-defined macro multi-line blocks <<< >>> (previously: "»".charCodeAt(0)); 171 187 \xAB \xBB
	text = text.replace(/<<<([\s\S]*?)>>>/g, function (str, $1) {
		var t = woas.user_parse(title,$1);
		if(woas.user_parse.post) return t; // if woas.user_parse.post is set by the user, then allow further parser postprocessing 
		html_tags.push(t);
		return "<!-- "+parse_marker+"::"+(html_tags.length-1)+" -->";
	});

	// <sub> subscript and <sup> superscript
	text = text.replace(/(,,|\^\^)(\S.*?)\1/g, function(str,$1,$2){
		var t = $1==',,'? "sub":"sup";
		return "<"+t+">"+$2+"</"+t+">";
	});
	// text = text.replace(/\^\^(\S.*?)\^\^/g, "<sup>$1</sup>");

	// put away code contained in multi-line "emphasized paragraph" blocks [[[ ]]]  and ,, '' (polish quotes) which were before: &#12300; or \u300C and &#12301; or \u300D
	text = text.replace(/(\[{3}|,,)([\s\S]*?)(\]{3}|'')/g, function (str, $1, $2) {
		var T= $1=='[[[' ? ["div","note"] : ['blockquote', 'citation'];
		return "<"+T[0]+" class=\""+T[1]+"\">"+$2+"</"+T[0]+">";
		//	// blocks allow for html, AND allow for wiki. If this is a problem, change this function back to:
		// var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		// html_tags.push("<div class=\""+($1=='['?'note':'citation')+"\">"+$2+"</div>");
		// return r;
	});

	// reset the array of custom scripts
	this.script_extension = [];
	if (js_mode) {
		// gather all script tags
		text = text.replace(/<script([^>]*)>((.|\n)*?)<\/script>/gi, function (str, $1, $2) {
			if (js_mode==2) {
				var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
				html_tags.push(str);
				return r;
			}
			var m=$1.match(/src=(?:"|')([^\s'">]+)/);
			if (m!=null)
				woas.parser.script_extension.push(new Array(m[1]));
			else
				woas.parser.script_extension.push($2);
			return "";
		});
	}
	
	// put a placeholder for the TOC
	var p = text.indexOf("[[Special::TOC]]");
	if (p != -1) {
		this.has_toc = true;
		text = text.substring(0, p) + "<!-- "+parse_marker+":TOC -->" + text.substring(p+16
//		+ 	((text.charAt(p+16)=="\n") ? 1 : 0)
		);	
	} else this.has_toc = false;

	// put away big enough HTML tags sequences (with attributes)
	text = text.replace(/(<\/?\w+[^>]+>[ \t]*)+/g, function (tag) {
		var r = "<!-- "+parse_marker+'::'+html_tags.length+" -->";
		html_tags.push(tag);
		return r;
	});
	
	// links with | 
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2) {
			if ($1.search(/^\w+:\/\//)==0) {
				var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
				html_tags.push("<a class=\"world\" href=\"" + $1.replace(/^mailto:\/\//, "mailto:") + "\" target=\"_blank\">" + $2 + "<\/a>");
				return r;
			}
				var page = $1;
				var hashloc = $1.indexOf("#");
				var gotohash = "";
				if (hashloc > 0) {
					page = $1.substr(0, hashloc);
					gotohash = "; window.location.hash= '" + $1.substr(hashloc) + "'";
				}
				if (woas.page_exists(page)) {
					var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
					var wl;
					if (export_links) {
//						if (this.page_index(page)==-1)
//							wl = " onclick=\"alert('not yet implemented');\"";		else
						wl = " href=\""+woas._export_get_fname(page)+"\"";
					} else
						wl = " href=\"?"+escape(page)+(hashloc>0?escape($1.substr(hashloc)):"")+"\" "+ " onclick=\"go_to('" + woas.js_encode(page) +	"')" + gotohash + ";return false;\"";
					html_tags.push("<a class=\"link\""+ wl + " >" + $2 + "<\/a>");
					return r;
				} else {
					if ($1.charAt(0)=="#") {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						var wl;
						if (export_links)
							wl = woas._export_get_fname(page);
						else wl = "";
						html_tags.push("<a class=\"link\" href=\""+wl+"#" +this.header_anchor($1.substring(1)) + "\">" + $2 + "<\/a>");
						return r;
					} else {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						var wl;
						if (export_links)
							wl=" href=\"#\"";
						else wl = "href=\"?"+escape($1)+"\" "+ " onclick=\"go_to('" +woas.js_encode($1)+"');return false;\"";
						html_tags.push("<a class=\"unlink\" "+wl+">" + $2 + "<\/a>");
						return r;
					}
				}
			}); // "<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// links without |
	var inline_tags = 0;
	// Allow use of Array's, for example: [[Javascript::alert(A[0])]] . Still need to check performance.
	// text = text.replace(/\[\[([^\]]*?)\]\]/g, function(str, $1) {
	text = text.replace(/\[\[(.*?)\]\]/g, function(str, $1) {
		if ($1.search(/^\w+:\/\//)==0) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			$1 = $1.replace(/^mailto:\/\//, "mailto:");
			html_tags.push("<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>");
			return r;
		}
		
		var found_tags = woas._get_tags($1); 
		
		if (found_tags.length>0) {
			tags = tags.concat(found_tags);
			if (!this.force_inline)
				return "";
			inline_tags++;
			return "<!-- "+parse_marker+":"+inline_tags+" -->";
		}
		
		if (woas.page_exists($1)) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			var wl;
			if (export_links)
				wl = " href=\""+woas._export_get_fname($1)+"\"";
			else
				wl = " href=\"?"+escape($1)+"\" "+ " onclick=\"go_to('" + woas.js_encode($1) +"');return false;\"";				
			html_tags.push("<a class=\"link\""+wl+">" + $1 + "<\/a>");
			return r;
		} else {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			if ($1.charAt(0)=="#") {
				html_tags.push("<a class=\"link\" href=\"#" +woas.parser.header_anchor($1.substring(1)) + "\">" + $1.substring(1) + "<\/a>");
			} else {
				var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
				var wl;
				if (export_links)
					wl=" href=\#\"";
				else
					wl = " onclick=\"go_to('" +woas.js_encode($1)+"')\"";
				html_tags.push("<a class=\"unlink\" "+wl+">" + $1 + "<\/a>");
			}
			return r;
		}
	}); // "<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");


	// Indent :  <div style="margin-left:2em"> or http://meyerweb.com/eric/css/tests/css2/sec08-03c.htm
	//alert(text);
	text = text.replace(/(^|\n|<br\/>)(:+)\s*([^\n]+)/g, function (str, $1,$2,$3) {
		return $1+"<span style=\"margin-left:"+($2.length)+"em\">"+$3+"</span>";
	});
	
	// allow non-wrapping newlines
	text = text.replace(/\\\\\n/g, "<br/>").replace(/\\\n/g, "");
	
	// <u>
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");

	// <strike>
	// <!-- #VRQXBzqc::2 -->, because <!-- #VRQXBzqc::3 -->
	text = text.replace(/(^|[^\w\/\\\<\>!\-])\-\-([^ >\-].*?[^ !])\-\-/g, "$1<strike>$2</strike>");
	
	// italics
	// need a space after ':'
	text = text.replace(/(^|[^\w:<])\/([^\n\/]+)\/($|[^\w>])/g, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1) {
			return str;
		}
		return $1+"<em>"+$2+"</em>"+$3;
	});
	
	// ordered/unordered lists parsing
	text = text.replace(reReapLists, this.parse_lists);
	
	// headers (from h1 to h6, as defined by the HTML 3.2 standard)
	text = text.replace(reParseHeaders, this.header_replace);
	// text = text.replace(reParseOldHeaders, this.header_replace);

		
	if (this.has_toc) {
		// remove the trailing newline
//		this.parser.toc = this.parser.toc.substr(0, this.parser.toc.length-2);
		// replace the TOC placeholder with the real TOC
		text = text.replace("<!-- "+parse_marker+":TOC -->",
				"<div class=\"wiki_toc\"><p class=\"wiki_toc_title\">Table of Contents</p>" +
				this.toc.replace(reReapLists, this.parse_lists) //.replace(/#/g, "?"+title+"#")
				/*.replace("\n<", "<") */
				+ "</div>" );
		this.toc = "";
	}
	
	// <strong> for bold text
	text = text.replace(/(^|[^\w\/\\])\*([^\*\n]+)\*/g, "$1"+parse_marker+"bS#$2"+parse_marker+"bE#");

	text = text.replace(new RegExp(parse_marker+"([ub])([SE])#", "g"), function (str, $1, $2) { // TODO: remove this replace code must be in bold parser and underscore parser
		if ($2=='E') {
			if ($1=='u')
				return "</span>";
			return "</strong>";
		}
		if ($1=='u')
			tag = "<span style=\"text-decoration:underline;\">";
		else
			tag = "<strong>";
		return tag;
	});

	// <hr> horizontal rulers made with 3 hyphens. 4 suggested. \s matches whitespace (short for  [\f\n\r\t\v\u00A0\u2028\u2029]) will eat all \n and leave nothing...
	text=text.replace(/(?:^|\n)[ \f\t\v\u00A0\u2028\u2029]*\-{3,}[ \f\t\v\u00A0\u2028\u2029]*(\n)/g, function(str,$1) { return "<hr />"+$1.substr(2);});	
	
	// tables-parsing pass
	text = text.replace(reReapTables, this.parse_tables);
	
	// cleanup \n after headers and lists
	text = text.replace(/((<\/h[1-6]><div class="level[1-6]">)|(<\/[uo]l>))(\n+)/g, function (str, $1, $2, $3, trailing_nl) {
		if (trailing_nl.length>2)
			return $1+trailing_nl.substr(2);
		return $1;
	});
	
	// remove \n before list start tags
	text = text.replace(/\n(<[uo]l>)/g, "$1");

	// end-trim
	if (end_trim)
		text = text.replace(/\s*$/, "");

	// compress newlines characters into paragraphs (disabled)
//	text = text.replace(/\n(\n+)/g, "<p>$1</p>");
//	text = text.replace(/\n(\n*)\n/g, "<p>$1</p>");

	// make some newlines cleanup after pre tags
	text = text.replace(/(<\/?pre>)\n/gi, "$1");

	// convert newlines to br tags
	text = text.replace(/\n/g, "<br />");

	// put back in place all HTML snippets
	if (html_tags.length>0) {
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
			return html_tags[$1];
		});
	}

	// sort the tags and append them to the page
	tags = tags.toUnique().sort();
	if (tags.length && !export_links) {
		var s;
		if (this.force_inline)
			s = "";
		else
			s = "<div class=\"taglinks\">";
		s += "Tags: ";
		for(var i=0;i<tags.length-1;i++) {
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+woas.js_encode(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"</a>";
		if (!this.force_inline) {
			s+="</div>";
			text += s;
		} else {
			text = text.replace(new RegExp("<\\!-- "+parse_marker+":(\\d+) -->", "g"), function (str, $1) {
				if ($1==inline_tags)
					return s;
				return "";
			});
		}
	}
	if (this.force_inline)
		this.force_inline = false;
		
	if (text.substring(0,5)!="</div")
		text =  "<div class=\"level0\">" + text + "</div>";
	else
		text = text.substring(6)+"</div>";

	// user defined after_parser
	if(title && typeof(woas["after_parser"])=='function')
		text = woas["after_parser"](text,title);

	return text;
}

