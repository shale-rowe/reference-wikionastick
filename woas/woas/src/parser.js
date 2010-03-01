
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

//var reParseOldHeaders = /(^|\n)(\!+)\s*([^\n]+)/g;
//var reParseOldHeaders = /(^|\n)(\!+)/g;
var reParseHeaders = /(^|\n)(=+)\s*([^\n]+)/g;

woas.parser["header_replace"] = function(text) {

	// replace old with new headers
//	text = text.replace(reParseOldHeaders, function(str, $1) {
//		return "\n" + str_rep("=", str.substring(1).length);
//	});

	var headerLevel = 0;
	var tabCount = 0;
	var tabLevel = 99;		// don't use -1 because of compare
	var tabMenu = "";

	// if no header or first header is not at the beginning -> insert level0
	if (text.search(reParseHeaders) != 0) {
		text = "<div class=\"level0\">" + text + "</div>";
	}

	text = text.replace(reParseHeaders, function(str, $1, $2, $3) {
		var header = $3;
		var len = $2.length;
		var replaceText = "";

		if (header.indexOf($2)==header.length - len)
			header = header.substring(0, header.length - len);

		// level equal -> 1 </div>
		// level down -> x </div>
		// level up -> no </div>
		if (len <= headerLevel) replaceText += str_rep("</div>", headerLevel - len + 1);
		headerLevel = len;

		// if tab
		if (header.indexOf("\[TAB\]") != -1) {
			// remove [TAB] from header-text
			header = header.replace(/\[TAB\]/, "");

			// if first-tab, next-tab or no-tab -> increase tabCount and set tabLevel
			if (((tabLevel == 99) || (tabLevel == headerLevel)) && (header.length != 0)) {
				tabCount++;
				tabLevel = len;
			} else {
				// insert tabCount-Max at placeholder
				tabMenu = tabMenu.replace(new RegExp(parse_marker + "::TABMAX", 'g'), tabCount);
				woas.parser.toc = woas.parser.toc.replace(new RegExp(parse_marker + "::TABMAX", 'g'), tabCount);
				// end of tab
				tabCount = 0;
				tabLevel = 99;
			}

			// StartTab
			if (tabCount == 1) {
				replaceText += "<div class=\"tabmenu\">" + parse_marker + "::TABMENU</div>";
				tabMenu += "<a id=\"tabmenu1\" href=\"javascript:showtab(1," + parse_marker + "::TABMAX)\" style=\"color:#A4A4A4; background:#F5F5F5; border-color:#A4A4A4; BORDER-BOTTOM: #f5f5f5 1px solid;  \">" + header + "</a> ";
			}
			// Tab
			else if (tabCount > 1) {
				tabMenu += "<a id=\"tabmenu" + tabCount + "\" href=\"javascript:showtab(" + tabCount + "," + parse_marker + "::TABMAX)\">" + header + "</a> ";
			}

			// EndTab
			if (header.length == 0) {
				replaceText += "<div class=\"tabmenu\"> </div>";
			}
		}

		// always add div, but if tab with id, and if in-tab with style-hidden
		replaceText += "<div class=\"level"+headerLevel+"\" "	+ ((headerLevel == tabLevel)?"id=\"tab" + tabCount + "\" ":"")
			+ ((tabCount > 1)?" style=\"display: none; visibility: hidden; \"":"") + ">";

		// automatically build the TOC if needed and if not end-tab
		if ((woas.parser.has_toc) && (header.length != 0)) {
			// always add table entry, if tab or in-tab add js-showtab
			woas.parser.toc += str_rep("#", len) + " <a class=\"link\" href=\"#" + woas.parser.header_anchor(header) + "\" "
				+ ((headerLevel >= tabLevel)?" onClick=\"showtab(" + tabCount + "," + parse_marker + "::TABMAX);\" ":"") + ">" + header + "<\/a>\n";
		}

		// always add anchor, but if tab with no text
		replaceText += "<h"+len+" id=\""+woas.parser.header_anchor(header)+"\">";
		if (tabLevel != headerLevel) replaceText += header;
    if (replaceText.indexOf("=\"tab") == -1)  replaceText += "<div\ id=fr><input\ class=wiki_button\ style=\"FONT-WEIGHT:\ bold;\"\ type=\"button\"\ value=\"^\"\ onclick=\"javascript:scroll(0,0)\"\ /></div>"
//    if (replaceText.indexOf("=\"tab") == -1)  replaceText += "<div\ id=fr><A\ style=\"TEXT-DECORATION:\ none;\ BORDER-BOTTOM:\ 0px\"\ class=link\ title=Top\ href=\"javascript:scroll(0,0)\"><IMG border=0\ alt=Top\ src=\"lib/images/ft_top.png\" /></A></div>"


		replaceText += "</h"+len+  ">";
	return replaceText;
	});

	// if no endtab - insert tabCount-Max at placeholder
	if (tabCount > 0) {
		tabMenu = tabMenu.replace(new RegExp(parse_marker + "::TABMAX", 'g'), tabCount);
		woas.parser.toc = woas.parser.toc.replace(new RegExp(parse_marker + "::TABMAX", 'g'), tabCount);
	}

	// insert tabMenu at placeholder
	var p = text.indexOf("<div class=\"tabmenu\">" + parse_marker + "::TABMENU</div>");
	if (p != -1) text = text.substr(0, p+21) + tabMenu + text.substr(p+39);

	// for each open headerlevel add missing </div>
	return text + str_rep("</div>", headerLevel);
}


woas.parser["sublist"] = function (lst, ll, suoro, euoro) {
	if (!lst.length)
		return '';

	if (lst[0][1].length > ll)
		return this.sublist(lst, ll+1, suoro, euoro);

	var item, sub;
	var s = '';
	while (lst[0][1].length == ll ) {
                item = lst.shift();
                sub = this.sublist(lst, ll + 1, suoro, euoro);
                if (sub.length)
                    s += '<li>' + item[2] + suoro + sub + euoro + '</li>' ;
                else
                    s += '<li>' + item[2] + '</li>';
		if (!lst.length)
			break;
	}
	return s;
}

// XHTML lists and tables parsing code by plumloco
// This is a bit of a monster, if you know an easier way please tell me!
// There is no limit to the level of nesting and it produces
// valid xhtml markup.
var reReapLists = /(?:^|\n)([\*#@])[ \t].*(?:\n\1+[ \t][^\n]+)*/g;
woas.parser["parse_lists"] = function(str, type, $2) {
        var uoro = (type!='*')?'ol':'ul';
        var suoro = '<' + uoro + ((type=='@') ? " type=\"a\"":"")+'>';
        var euoro = '</' + uoro + '>';
        var old = 0;
        var reItems = /^([\*#@]+)[ \t]([^\n]+)/mg;

		var stk = [];
	    str.replace( reItems,
                function(str, p1, p2)
                {
                    level = p1.length;
                    old = level;
                    stk.push([str, p1, p2]);
                }
            );

		return "\n"+suoro + woas.parser.sublist(stk, 1, suoro, euoro) + euoro;
	}

var reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm;
woas.parser["parse_tables"] =  function (str, p1) {
        var caption = '';
        var stk = [];
        p1.replace( /\n\|([+ -\|])(.*)/g, function(str, pp1, pp2) {
                if (pp1 == '-') // currently a remark, but could be used for meta information in the future
                        return;
                if (pp1 == '+') // set the caption
                        return caption = caption || ('<caption' + (stk.length>0? ' style="caption-side:bottom">':'>') + pp2+ '</caption>');
                if(pp1 == '|') // fix empty first cell
                        pp2= " |"+pp2;
                //var cells = pp2.replace(/(\|\|)\s{0,1}(\s?)(?=\|\|)/g,"$1$2  ").replace(/(\|\|\s*)$/, "$1 ").split(" || "); // allow for zero (or single) spaced SPAN cells, then split them 
                var cells = pp2.replace(/(\|)(\s{0,1})(\s?)(?=\|)/g,"$1$2$3  ").replace(/(\|\s*)$/, "$1 ").split(" | "); // allow for zero spaced SPAN cells, then split them
                //alert("CELLS="+cells.join("*").replace(/ /g, "~")+"=")
                var row = [];       // table row
                var stag = "";      // start tag
                var cs = 0;         // counter for spanned columns
                for (var i=cells.length - 1; i >= 0; --i){
                        var C = cells[i].match(/^(\s*)(=\s*)?(.*?)(\s*)$/) ; // ||[]; // if we fail to parse, at least dont crash
                        //alert("C="+C.join("*").replace(/ /g, "~")+"=")
                        if (i && !C[3] && !C[1]) { // if empty and not first column, increase span counter.
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

reReapColumns = /<columns\b[^>]*>(.*?)<\/columns>/g;
woas.parser["parse_columns"] =  function (str) {
     colsw = str.substr(str.indexOf("<columns"), str.indexOf(">")).match(/([0-9]{1,3}%)|-/g);
     cols = str.replace(/<\/*columns(\s*([0-9]{1,3}%)*|-)*>(<br\ \/>)*/gm, "").replace(/(<br\ \/>)*<nextcolumn>(<br\ \/>)*/g, "<nextcolumn>").split("<nextcolumn>");
     if (!colsw)
         colsw = new Array('-');
     for (var i=(colsw.length); i<=cols.length; ++i)
         colsw.push("-");
     var rtext =  "<table class='columns-plugin'" + (colsw[0] != "-"?" style='width:" + colsw.shift() + "'": colsw.shift()) + ">";
     for (var i=0; i<colsw.length; ++i)
         rtext =  rtext + "<col" + (colsw[i] != "-"?" style='width:" + colsw[i] + "'": "") + ">";
     rtext = rtext + "<tr>";
     for (var i=0; i<cols.length; ++i)
         rtext = rtext + "<td class='" + (i == 0?"first" : "last") + "'>" + cols[i] + "</td>";         
     rtext = rtext + "</tr></table>";
     return rtext;
}

// remove wiki and html that should not be viewed when previewing wiki snippets
function _filter_wiki(s) {
  var nowiki = s.match(/\{\{\{((.|\n)*?)\}\}\}/g);
  var t = s.replace(/\{\{\{((.|\n)*?)\}\}\}/g, "").
		replace(/<script[^>]*>((.|\n)*?)<\/script>/gi, "").
		replace(/\<\w+\s[^>]+>/g, "").
		replace(/\<\/\w[^>]+>/g, "");
  if (nowiki) {
    for (var i = 0; i < nowiki.length; ++i)  
      t += (nowiki[i].replace (/\{\{\{/g, " ").replace (/\}\}\}/g, " "));
  }     
  return t;

//    replace(/<script[^>]*>((.|\n)*?)<\/script>\{\{\{/gi, "").
//    replace(/\}\}\}<script[^>]*>((.|\n)*?)<\/script>/g, "").
//    replace(/\<\w+\s[^>]+>\{\{\{/g, "").
//    replace(/\}\}\}\<\w+\s[^>]+>/g, "").
//    replace(/\<\/\w[^>]+>\{\{\{/g, "").
//    replace(/\}\}\}\<\/\w[^>]+>/g, "");
//	return s.replace(/<script[^>]*>((.|\n)*?)<\/script>*/gi, "").
//		replace(/\<\w+\s[^>]+>/g, "").
//		replace(/\<\/\w[^>]+>/g, "");
}

// THIS is the method that you should override for your custom parsing needs
// text is the raw wiki source
// export_links is set to true when exporting wiki pages and is used to generate proper href for hyperlinks
// js_mode can be 0 = leave script tags as they are (for exporting), 1 - place script tags in <head /> (dynamic),
//		2 - re-add script tags after parsing
woas.parser["parse"] = function(text, export_links, js_mode) {
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

	// this array will contain all the HTML snippets that will not be parsed by the wiki engine
	var html_tags = [];

	// put away stuff contained in inline nowiki blocks {{{ }}}
	text = text.replace(/\{\{\{(.*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<tt class=\"wiki_preformatted\">"+woas.xhtml_encode($1)+"</tt>");
		return r;
	});

	// put away stuff contained in inline nowiki blocks {{{ }}}
	text = text.replace(/<pre>*<\/pre>}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<tt class=\"wiki_preformatted\">"+woas.xhtml_encode($1)+"</tt>");
		return r;
	});

 	// transclusion code - originally provided by martinellison
	if (!this.force_inline) {
		var trans_level = 0;
		do {
			var trans = 0;
			text = text.replace(/\[\[Include::([^\]]+)\]\]/g, function (str, $1) {
				var parts = $1.split("|");
				var templname = parts[0];
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
						if (export_links)
							img = "<img class=\"embedded\" src=\""+woas._export_get_fname(templname)+"\" alt=\""+img_name+"\" ";
						else
							img = "<img class=\"embedded\" src=\""+templtext+"\" ";
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
					templtext = templtext.replace(/%(\d+)/g, function(param, paramno) {
						if (paramno < parts.length)
							return parts[paramno];
						else
							return param;
					} );
				}
				trans = 1;
				return templtext;
			});
			// keep transcluding when a transclusion was made and when transcluding depth is not excessive
		} while (trans && (++trans_level < 16));
		if (trans_level == 16) // remove Include:: from the remaining inclusions
			text = text.replace(/\[\[Include::([^\]\|]+)(\|[\]]+)?\]\]/g, "[<!-- -->[Include::[[$1]]$2]]");
	}

	// thank you IE, really thank you
	if (ie)
		text = text.replace("\r\n", "\n");

	var tags = [];

	// put away raw text contained in multi-line nowiki blocks {{{ }}}
	text = text.replace(/\{\{\{((.|\n)*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<pre class=\"wiki_preformatted\">"+woas.xhtml_encode($1)+"</pre>");
		return r;
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
					gotohash = "; window.location.hash= \"" + $1.substr(hashloc) + "\"";
				}
				if (woas.page_exists(page)) {
					var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
					var wl;
					if (export_links) {
//						if (this.page_index(page)==-1)
//							wl = " onclick=\"alert('not yet implemented');\"";		else
						wl = " href=\""+woas._export_get_fname(page)+"\"";
					} else
						wl = " onclick=\"go_to('" + woas.js_encode(page) +	"')" + gotohash + "\"";
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
						else wl = " onclick=\"go_to('" +woas.js_encode($1)+"')\"";
						html_tags.push("<a class=\"unlink\" "+wl+">" + $2 + "<\/a>");
						return r;
					}
				}
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// links without |
	var inline_tags = 0;
	text = text.replace(/\[\[([^\]]*?)\]\]/g, function(str, $1) {
		if ($1.search(/^\w+:\/\//)==0) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			$1 = $1.replace(/^mailto:\/\//, "mailto:");
			html_tags.push("<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>");
			return r;
		}

		found_tags = woas._get_tags($1);

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
				wl = " onclick=\"go_to('" + woas.js_encode($1) +"')\"";

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
	}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");

	// allow non-wrapping newlines
	text = text.replace(/\\\n/g, "");

	// <u>
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");

	// italics
	// need a space after ':'
	text = text.replace(/(^|[^\w:])\/([^\n\/]+)\/($|[^\w])/g, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1) {
			return str;
		}
		return $1+"<em>"+$2+"</em>"+$3;
	});

	// ordered/unordered lists parsing (code by plumloco)
	text = text.replace(reReapLists, this.parse_lists);

	// headers (from h1 to h6, as defined by the HTML 3.2 standard)
//	text = text.replace(reParseHeaders, this.header_replace);
//	text = text.replace(reParseOldHeaders, this.header_replace);
 	text = this.header_replace(text);

	if (this.has_toc) {
		// remove the trailing newline
//		this.parser.toc = this.parser.toc.substr(0, this.parser.toc.length-2);
		// replace the TOC placeholder with the real TOC
		text = text.replace("<!-- "+parse_marker+":TOC -->",
				"<div class=\"wiki_toc_header\" style=\"cursor:pointer;\"><p onclick=\"spoil('toc');\" class=\"wiki_toc_title\">Table of Contents ...</p></div><div class=\"wiki_toc\" id=\"toc\" style=\"display:none;\">" + 
				this.toc.replace(reReapLists, this.parse_lists)
				/*.replace("\n<", "<") */
				+ "</div>" );
		this.toc = "";
	}

	// <strong> for bold text
	text = text.replace(/(^|[^\w\/\\])\*([^\*\n]+)\*/g, "$1"+parse_marker+"bS#$2"+parse_marker+"bE#");

	// <strike>
	//text = text.replace(/(^|\n|\s|\>|\*)\--(.*?)\--/g, "$1<strike>$2<\/strike>");

	text = text.replace(new RegExp(parse_marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
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

	// <hr> horizontal rulers made with 3 hyphens. 4 suggested
	text = text.replace(/(^|\n)\s*\-{3,}\s*(\n|$)/g, "<hr />");

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

//footnote plugin
        try{
          woas["FOOTNOTES"] = [];
              var n = 0;
          text= text.replace(/<<<((.|\n)*?)>>>/g, function(s,$1){
                woas["FOOTNOTES"].push($1);
                n =woas["FOOTNOTES"].length;
                return '<sup><a style="text-decoration:none; COLOR: #c60" title="' + $1  + '" name="_notefoot'+n+'"href="#_footnote'+n+'">'+n+')</a></sup>';
          });
        var fn="";
        for(var i=0,l=woas["FOOTNOTES"].length;i<l;i++){
          n = i+1;
          fn += '<tr><td VALIGN="top"><sup><a style="text-style: normal; text-decoration:none; COLOR: #c60" name="_footnote'+n+'" href="#_notefoot'+n+'">' +n+ "</a>)</sup></td><td>" + woas["FOOTNOTES"][i]  +"</td></tr>";
        }
        text = text + (fn?'<br/><div class="footnote"><table border=0>' +fn+ '</table></div>' :'');
        }catch(e){alert(e)}
//footnote plugin

	tags = tags.toUnique();
	if (tags.length && !export_links) {
		var s;
		if (this.force_inline)
			s = "";
		else
			s = "<div class=\"taglinks\">";
		  s += "<IMG border=0 src=\"lib/images/label.png\" />  ";
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

//	if (text.substring(0,5)!="</div")
//		return "<div class=\"level0\">" + text + "</div>";
//	return text.substring(6)+"</div>";

//note plugin
	text = text.replace(/<note>(<br\ \/>)?/g, "<div class=\"noteclassic\">");
	text = text.replace(/<note\ tip>(<br\ \/>)?/g, "<div class=\"notetip\">");
	text = text.replace(/<note\ warning>(<br\ \/>)?/g, "<div class=\"notewarning\">");
	text = text.replace(/<note\ important>(<br\ \/>)?/g, "<div class=\"noteimportant\">");
	text = text.replace(/<note\ example>(<br\ \/>)?/g, "<div class=\"noteexample\">");
	text = text.replace(/<note\ plus>(<br\ \/>)?/g, "<div class=\"noteplus\">");
	text = text.replace(/<note\ minus>(<br\ \/>)?/g, "<div class=\"noteminus\">");
	text = text.replace(/<\/note>(<br\ \/>)?/g, "</div>");

//column plugin
        text = text.replace(reReapColumns, this.parse_columns);

//styler plugin
	text = text.replace(/<epigraph>(<br\ \/>)?/g, "<div class=\"epigraph\">");
	text = text.replace(/<\/epigraph>(<br\ \/>)?/g, "</div>");

	text = text.replace(/<quote>(<br\ \/>)?/g, "<div class=\"quote\">");
	text = text.replace(/<\/quote>(<br\ \/>)?/g, "</div>");


//alert (text);
	return text;
}
