
woas["parser"] = {
	"has_toc":null,
	"toc":"",
	"force_inline":false,		// used not to break layout when presenting search results
	"script_extension":[]		// external javascript files to be loaded
};

woas.parser["header_anchor"] = function(s) {
	// apply a hard normalization
	// WARNING: will not preserve header ids uniqueness
	return s.replace(/[^a-zA-Z0-9]/g, '_');
}

var reParseOldHeaders = /^(\!+)\s*(.*)$/gm;	//DEPRECATED

var reParseHeaders = /^(=+)\s*(.*)$/gm;
woas.parser["header_replace"] = function(str, $1, $2) {
		var header = $2;
		var len = $1.length;
		if (header.indexOf($1)==header.length - len)
			header = header.substring(0, header.length - len);
		// automatically build the TOC if needed
		len = $1.length;
		if (woas.parser.has_toc) {
			woas.parser.toc += String("#").repeat(len)+" <a class=\"link\" href=\"#" +
			woas.parser.header_anchor(header) + "\">" + header + "<\/a>\n";
		}
		return "</div><h"+len+" id=\""+woas.parser.header_anchor(header)+"\">"+header+"</h"+len+"><div class=\"level"+len+"\">";
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
var reReapLists = /^([\*#@])[ \t].*(?:\n\1+[ \t].+)*/gm;
woas.parser["parse_lists"] = function(str, type, $2) {
        var uoro = (type!='*')?'ol':'ul';
        var suoro = '<' + uoro + ((type=='@') ? " type=\"a\"":"")+'>';
        var euoro = '</' + uoro + '>';
        var old = 0;
        var reItems = /^([\*#@]+)[ \t]([^\n]+)/mg;

		var stk = [];
	    str.replace( reItems, function(str, p1, p2) {
                    level = p1.length;
                    old = level;
                    stk.push([str, p1, p2]);
                }
            );

		return suoro + woas.parser.sublist(stk, 1, suoro, euoro) + euoro;
	}

var reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm;	
woas.parser["parse_tables"] =  function (str, p1) {
        var caption = false;
        var stk = [];
        p1.replace( /\n\|([+ -])(.*)/g, function(str, pp1, pp2) {
                if (pp1 == '-')
                    return;
                if (pp1 == '+') {
                    caption = caption || pp2;
                    return;
                }
                stk.push('<td>' + pp2.split(' ||').join('</td><td>') + '</td>');
            } 
        );
        return  '<table class="text_area">' +
                    (caption?('<caption>' + caption + '</caption>'):'') +
                    '<tr>' + stk.join('</tr><tr>') + '</tr>' +
                '</table>' 
    }

// remove wiki and html that should not be viewed when previewing wiki snippets
function _filter_wiki(s) {
	return s.replace(/\{\{\{((.|\n)*?)\}\}\}/g, "").
		replace(/<script[^>]*>((.|\n)*?)<\/script>/gi, "").
		replace(/\<\/?\w+[^>]+>/g, "");
}

var	parse_marker = "#"+_random_string(8);

// extract the wiki tags from a wiki URL
woas["_get_tags"] = function(text) {
	var tags = [];
	// remove the starting part
	if (text.indexOf("Tag::")==0)
		text = this.trim(text.substring(5));
	else if (text.indexOf("Tags::")==0)
		text = this.trim(text.substring(6));
	else // not a valid tagging
		return tags;
	// check length only after having removed the part we don't need
	if (!text.length)
		return tags;
	var alltags = this.split_tags(text);
	for(var i=0;i<alltags.length;i++) {
		tags.push(this.trim(alltags[i]));
	}
	return tags;
}

// split one or more tags
// note: no trim applied
woas["split_tags"] = function(tlist) {
	var alltags;
	if (tlist.indexOf("|")!=-1)
		return tlist.split("|");
	else //DEPRECATED
		return tlist.split(",");
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
	
	// transclusion code - originally provided by martinellison
	if (!this.force_inline) {
		var trans_level = 0;
		do {
			var trans = 0;
			text = text.replace(/\[\[Include::([^\]]+)\]\]/g, function (str, $1) {
				var parts = $1.split("|");
				var templname = parts[0];
//				log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
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
						if (export_links) {
							// check that the URI is valid
							var uri=woas._export_get_fname(templname);
							if (uri == '#')
								img = '<!-- missing image '+img_name+' -->';
							else
								img = "<img class=\"embedded\" src=\""+uri+"\" alt=\""+img_name+"\" ";
						} else
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
	
	// remove CR added by some browsers
	//TODO: check if ie8 still adds these
	if (woas.browser.ie || woas.browser.opera)
		text = text.replace("\r\n", "\n");

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

	// wiki tags
	var tags = [], inline_tags = 0;
	
	// links with pipe e.g. [[Page|Title]]
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2) {
		// check for protocol
		if ($1.search(/^\w+:\/\//)==0) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			html_tags.push("<a class=\"world\" href=\"" + $1.replace(/^mailto:\/\//, "mailto:") + "\" target=\"_blank\">" + $2 + "<\/a>");
			return r;
		}
			
		// is this a tag definition?
		var found_tags = woas._get_tags(str.substring(2, str.length-2));
		if (found_tags.length>0) {
			tags = tags.concat(found_tags);
			if (!this.force_inline)
				return "";
			++inline_tags;
			return "<!-- "+parse_marker+":"+inline_tags+" -->";
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
					// section reference URIs
					if ($1.charAt(0)=="#") {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						var wl;
						if (export_links)
							wl = woas._export_get_fname(page);
						else
							wl = '';
						if (wl == '#')
							html_tags.push("<span class=\"broken_link\">" + $2 + "<\/span>");
						else {
							html_tags.push("<a class=\"link\" href=\""+
							wl+"#" +
							this.header_anchor($1.substring(1)) + "\">" + $2 + "<\/a>");
						}
						return r;
					} else {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						if (export_links) {
							html_tags.push("<span class=\"broken_link\">" + $2 + "<\/span>");
							return r;
						}
						var wl = " onclick=\"go_to('" +woas.js_encode($1)+"')\"";
						html_tags.push("<a class=\"unlink\" "+wl+">" + $2 + "<\/a>");
						return r;
					}
				}
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");

	// links without pipe e.g. [[Page]]
	text = text.replace(/\[\[([^\]]*?)\]\]/g, function(str, $1) {
		// check for protocol
		if ($1.search(/^\w+:\/\//)==0) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			$1 = $1.replace(/^mailto:\/\//, "mailto:");
			html_tags.push("<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>");
			return r;
		}
		
		// is this a tag definition?
		var found_tags = woas._get_tags($1);
		if (found_tags.length>0) {
			tags = tags.concat(found_tags);
			if (!this.force_inline)
				return "";
			++inline_tags;
			return "<!-- "+parse_marker+":"+inline_tags+" -->";
		}
		
		if (woas.page_exists($1)) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			var wl;
			if (export_links) {
				wl = woas._export_get_fname($1);
				if (wl == '#') {
					html_tags.push("<span class=\"broken_link\">" + $1 + "<\/span>");
					return r;
				}
				wl = " href=\""+wl+"\"";
			} else
				wl = " onclick=\"go_to('" + woas.js_encode($1) +"')\"";
			html_tags.push("<a class=\"link\""+wl+">" + $1 + "<\/a>");
			return r;
		} else {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			if ($1.charAt(0)=="#") {
				html_tags.push("<a class=\"link\" href=\"#" +woas.parser.header_anchor($1.substring(1)) + "\">" + $1.substring(1) + "<\/a>");
			} else {
				var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
				if (export_links) {
					html_tags.push("<span class=\"unlink broken_link\">" + $1 + "<\/span>");
					return r;
				}
				var wl = " onclick=\"go_to('" + woas.js_encode($1) +"')\"";
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
	text = text.replace(reParseHeaders, this.header_replace);
	text = text.replace(reParseOldHeaders, this.header_replace);
	
	if (this.has_toc) {
		// remove the trailing newline
//		this.parser.toc = this.parser.toc.substr(0, this.parser.toc.length-2);
		// replace the TOC placeholder with the real TOC
		text = text.replace("<!-- "+parse_marker+":TOC -->",
				"<div class=\"wiki_toc\"><p class=\"wiki_toc_title\">Table of Contents</p>" +
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

	// <hr> horizontal rulers made with 3 hyphens, 4 suggested
	// only white spaces are allowed after the hyphens
	text = text.replace(/^\s*\-{3,}[ ]*$/gm, "<hr class=\"woas_ruler\" />");
	
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
	
	// sort tags at bottom of page, also when showing namespaces
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
		} else { // re-print the inline tags (works only on last tag definition?)
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
		return "<div class=\"level0\">" + text + "</div>";
	return text.substring(6)+"</div>";
}
