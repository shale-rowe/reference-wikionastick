
woas.parser = {
	"has_toc":null,
	"toc":"",
	"force_inline":false,		// used not to break layout when presenting search results
	"script_extension":[]		// external javascript files to be loaded
};

woas.parser.header_anchor = function(s) {
	// apply a hard normalization
	// WARNING: will not preserve header ids uniqueness
	return s.replace(/[^a-zA-Z0-9]/g, '_');
};

//DEPRECATED "!" syntax is supported but shall me removed soon
var reParseHeaders = /^([\!=]+)\s*(.*)$/gm;
woas.parser.header_replace = function(str, $1, $2) {
		var header = $2;
		var len = $1.length;
		// remove the mirrored header syntax from right
		var hpos = header.indexOf($1);
		if ((hpos != -1) && (hpos==header.length - len))
			header = header.substring(0, header.length - len);
		// automatically build the TOC if needed
		len = $1.length;
		if (woas.parser.has_toc) {
			woas.parser.toc += String("#").repeat(len)+" <a class=\"link\" href=\"#" +
			woas.parser.header_anchor(header) + "\">" + header + "<\/a>\n";
		}
		return "</div><h"+len+" class=\"woas_header\" id=\""+woas.parser.header_anchor(header)+"\">"+header+"</h"+len+"><div class=\"woas_level"+len+"\">";
};

woas.parser.sublist = function (lst, ll, suoro, euoro) {   
	if (!lst.length)
		return '';
	
	if (lst[0][1].length > ll)
		return this.sublist(lst, ll+1, suoro, euoro);
	
	var item, subl;
	var s = '';
	while (lst[0][1].length == ll ) {
                item = lst.shift();
                subl = this.sublist(lst, ll + 1, suoro, euoro);
                if (subl.length)
                    s += '<li>' + item[2] + suoro + subl + euoro + '</li>' ;
                else
                    s += '<li>' + item[2] + '</li>';
		if (!lst.length)
			break;
	}
	return s;  
};

// XHTML lists and tables parsing code by plumloco
// This is a bit of a monster, if you know an easier way please tell me!
// There is no limit to the level of nesting and it produces
// valid xhtml markup.
var reReapLists = /^([\*#@])[ \t].*(?:\n\1+[ \t].+)*/gm;
var reItems = /^([\*#@]+)[ \t]([^\n]+)/mg;
woas.parser.parse_lists = function(str, type, $2) {
	var uoro = (type!='*')?'ol':'ul';
	var suoro = '<' + uoro + ((type=='@') ? " type=\"a\"":"")+'>';
	var euoro = '</' + uoro + '>';

	// collect all items in a stack
	var stk = [];
	str.replace( reItems, function(str, p1, p2) {
		stk.push([str, p1, p2]);
	} );

	return suoro + woas.parser.sublist(stk, 1, suoro, euoro) + euoro;
};

var reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm;
var reReapTableRows = /\n\|([+ -])(.*)/g;
woas.parser.parse_tables =  function (str, p1) {
	var caption = false;
	var stk = [];
	p1.replace(reReapTableRows, function(str, pp1, pp2) {
			if (pp1 == '-')
				return;
			if (pp1 == '+') {
				caption = caption || pp2;
				return;
			}
			stk.push('<td>' + pp2.split('||').join('</td><td>') + '</td>');
		} 
	);
	return  '<table class="woas_text_area">' +
				(caption?('<caption>' + caption + '</caption>'):'') +
				'<tr>' + stk.join('</tr><tr>') + '</tr>' +
			'</table>';
};

// new table parsing by FBNil
var reReapTablesNew = /^\{\|(.*)((?:\n\|.*)*)$/gm,
	reReapTablesNewSub1 = /\n\|([+ \t-\|])(.*)/g,
	reReapTablesNewSub2 = /(\|\|)(\s{0,1})(\s?)(?=\|\|)/g,
	reReapTablesNewSub3 = /(\|\|\s*)$/,
	reReapTablesNewSub4 = /\|\|\t/g,
	reReapTablesNewSub5 = /\t\|\|/g;
	
woas.parser.parse_tables_new = function (str, prop, p1) {
    var caption = '',
		colgroup = '',
		stk = [],
		cols = [],
		CC = [];
	// variables used by replace callback
	var cells, row, stag, cs, i, C, CL;
    p1.replace(reReapTablesNewSub1, function (str, pp1, pp2) {
        if (pp1 == '-') return;
        if (pp1 == '+') return caption = caption || ('<caption' + (stk.length > 0 ? ' style="caption-side:bottom">' : '>') + pp2 + '</caption>');
        if (pp1 == '*') return colgroup = pp2;
        if (pp1 == '$') return CC.push(pp2);
        if (pp1 == '|') pp2 = " |" + pp2;
        if (pp1 == ' ' && pp2.match(/^\|/)) // fix empty first cell
        pp2 = "  " + pp2;

        cells = pp2.replace(reReapTablesNewSub2, "$1$2$3  ").
				replace(reReapTablesNewSub3, "$1 ").replace(reReapTablesNewSub4, "|| ").replace(reReapTablesNewSub5, " ||").split(" || ");
        row = [];
        stag = "";
        cs = 0;
        for (i = cells.length - 1; i >= 0; --i) {
            C = cells[i].match(/^(\s*)(?:(=+)\s*)?(.*?)(\s*)$/);
            if (i && !C[3] && !C[1] && !C[2]) {
                ++cs;
                continue;
            } else if (i == 0 && !C[3]) C[3] = "&nbsp;";
            CL = C[2] ? C[2].length : 0;
            stag = '<' + (CL == 1 ? 'th' : 'td') + (CL > 1 ? ' ' + CC[CL - 2] || '' : '') + (cs ? ' colspan=' + ++cs : '') + (C[1] ? ' align=' + (C[4] ? 'center' : 'right') : '') + '>';
            cs = 0;
            row.unshift(stag + C[3] + (CL == 1 ? '</th>' : '</td>'));
        }
        stk.push(row.join(""));
    });
    return '<table ' + ((prop.indexOf("class=")!==-1) ? '' : 'class="woas_text_area" ') + prop + '>' + caption + colgroup + '<tr>' + stk.join('</tr><tr>') + '</tr>' + '</table>'
}

var	parse_marker = "#"+_random_string(8);

// extract the wiki tags from a wiki URL
woas._get_tags = function(text) {
	var tags = [];
	// remove the starting part
	if (text.indexOf("Tag::")===0)
		text = this.trim(text.substring(5));
	else if (text.indexOf("Tags::")===0)
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
};

// split one or more tags
// note: no trim applied
woas.split_tags = function(tlist) {
	var alltags;
	if (tlist.indexOf("|")!=-1)
		return tlist.split("|");
	else //DEPRECATED
		return tlist.split(",");
};

var reScripts = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
var reStyles = /<style([^>]*)>[\s\S]*?<\/style>/gi;
var reNowiki = /\{\{\{([\s\S]*?)\}\}\}/g;
var reTransclusion = /\[\[Include::([\s\S]+?)\]\]/g;
var reMacros = /<<<([\s\S]*?)>>>/g;
var reComments = /<\!--([\s\S]*?)-->/g;
var reWikiLink = /\[\[([^\]\]]*?)\|(.*?)\]\]/g;
var reWikiLinkSimple = /\[\[([^\]]*?)\]\]/g;

var _MAX_TRANSCLUSION_RECURSE = 256;

woas.parser.place_holder = function (i, separator) {
	if (typeof separator == "undefined")
		separator = "";
	separator = ":"+separator+":";
	return "<!-- "+parse_marker+separator+i+" -->";
};

// create a preformatted block ready to be displayed
woas._make_preformatted = function(text) {
	var cls, tag, p = text.indexOf("\n");
	if (p == -1) {
		cls = "wiki_preformatted";
		tag = "tt";
	} else {
		// remove the first newline to be compliant with old parsing
		if (p===0)
			text = text.substr(1);
		cls = "woas_nowiki_multiline";
		tag = "div";
	}
	var xhtml = this.xhtml_encode(text);
	// convert the newlines
	if (this.browser.ie)
		xhtml = xhtml.replace(/\n/g, "\r\n");
	return "<"+tag+" class=\""+cls+"\">"+xhtml+"</"+tag+">";
}

// THIS is the method that you should override for your custom parsing needs
// 'text' is the raw wiki source
// 'export_links' is set to true when exporting wiki pages and is used to generate proper href for hyperlinks
// 'js_mode' controls javascript behavior. Allowed values are:
// 0 = leave script tags as they are (used for exporting)
// 1 - place script tags in <head /> (dynamic),
// 2 - re-add script tags after parsing
// 3 - convert script tags to nowiki blocks
woas.parser.parse = function(text, export_links, js_mode) {
	if (woas.config.debug_mode) {
		if ((text===null) || (typeof text == "undefined")) {
			log("Called parse() with null/undefined text!");	// log:1
			return null;
		}
	}
	// default fallback
	if (typeof export_links == "undefined")
		export_links = false;
	if (typeof js_mode == "undefined")
		js_mode = 1;
	
	// this array will contain all the HTML snippets that will not be parsed by the wiki engine
	var snippets = [],
		comments = [],
		r;
	
	// put away comments
	text = text.replace(reComments, function (str, comment) {
		// skip whitespace comments
		if (comment.match(/^\s+$/))
			return str;
		r = woas.parser.place_holder(comments.length, "c");
		comments.push(str);
		return r;
	});

	// put away stuff contained in inline nowiki blocks {{{ }}}
	text = text.replace(reNowiki, function (str, $1) {
		r = woas.parser.place_holder(snippets.length);
		if (comments.length) {
			$1 = $1.replace(new RegExp("<\\!-- "+parse_marker+":c:(\\d+) -->", "g"), function (str, $1) {
				var c=comments[$1];
				comments[$1] = "";
				return c;
			});
		}
		snippets.push(woas._make_preformatted($1));
		return r;
	});
	
	// transclude pages (templates)
	if (!this.force_inline) {
		var trans_level = 0;
		var trans;
		do {
			trans = 0;
			text = text.replace(reTransclusion, function (str, $1) {
				var parts = $1.split("|");
				var templname = parts[0];
//				log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
				// in case of embedded file, add the inline file or add the image
				var is_emb = false, templtext, ns=woas.get_namespace(templname, true);
				if (woas.is_reserved(templname) || (templname.substring(templname.length-2)=="::"))
					templtext = woas.get_text_special(templname);
				else {
					var epi = woas.page_index(templname);
					// offer a link for uploading, to implement feature as before 0.11.0
					if (epi == -1)
						templtext = "[<!-- -->[Include::[["+templname+"]]]]";
					else {
						templtext = woas.get__text(epi);
						is_emb = woas.is_embedded(templname);
					}
				}
				// template retrieval error
				if (templtext === null) {
					var templs="[["+templname+"]]";
					if (parts.length>1)
						templs += "|"+parts.slice(1).join("|");
					r = woas.parser.place_holder(snippets.length);
					// show an error with empty set symbol
					snippets.push(woas.parser.render_error(str, "#8709"));
					return r;
				}
				if (is_emb) {
					r = woas.parser.place_holder(snippets.length);
//					log("Embedded file transclusion: "+templname);	// log:0
					if (woas.is_image(templname)) {
						var img, img_name = woas.xhtml_encode(templname.substr(templname.indexOf("::")+2));
						if (export_links) {
							// check that the URI is valid
							var uri=woas._export_get_fname(templname);
							if (uri == '#')
								img = woas.parser.render_error(templname, "#8709");
							else
								img = "<img class=\"woas_embedded\" src=\""+uri+"\" alt=\""+img_name+"\" ";
						} else
							img = "<img class=\"woas_embedded\" src=\""+templtext+"\" ";
						if (parts.length>1) {
							img += parts[1];
							// always add the alt attribute to images
							if (!export_links && !parts[1].match(/alt=('|").*?\1/))
								img += " alt=\""+img_name+"\"";
						}
						snippets.push(img+" />");
					} else { // embedded file but not image
						if ((parts.length>1) && (parts[1]=="raw"))
							snippets.push(decode64(templtext));
						else
							snippets.push("<pre class=\"woas_embedded\">"+
									woas.xhtml_encode(decode64(templtext))+"</pre>");
					}
					templtext = r;
				}
				trans = 1;
				
				if (!is_emb) {
					// both comments and nowiki blocks are pre-parsed
					// put away comments
					templtext = templtext.replace(reComments, function (str, comment) {
						// skip whitespace comments
						if (comment.match(/^\s+$/))
							return str;
						r = woas.parser.place_holder(comments.length, "c");
						comments.push(str);
						return r;
					});

					// put away stuff contained in inline nowiki blocks {{{ }}}
					templtext = templtext.replace(reNowiki, function (str, $1) {
						r = woas.parser.place_holder(snippets.length);
						if (comments.length) {
							$1 = $1.replace(new RegExp("<\\!-- "+parse_marker+":c:(\\d+) -->", "g"), function (str, $1) {
								var c=comments[$1];
								comments[$1] = "";
								return c;
							});
						}
						snippets.push(woas._make_preformatted($1));
						return r;
					});
				
					 if (parts.length) { // replace transclusion parameters
						templtext = templtext.replace(/%\d+/g, function(str) {
							var paramno = parseInt(str.substr(1));
							if (paramno < parts.length)
								return parts[paramno];
							else
								return str;
						} );
					}
				} // not embedded
				
				return templtext;	
			});
			// keep transcluding when a transclusion was made and when transcluding depth is not excessive
		} while (trans && (++trans_level < _MAX_TRANSCLUSION_RECURSE));
		if (trans_level == _MAX_TRANSCLUSION_RECURSE) { // parse remaining inclusions as normal text
			text = text.replace(reTransclusion, function (str) {
				r = woas.parser.place_holder(snippets.length);
				snippets.push(woas.parser.render_error(str, "infin"));
				return r;
			});
		}
	}
	
	// take a backup copy of the macros, so that no new macros are defined after page processing
	var backup_macro_n = woas.macro_parser.macro_names.slice(0),
		backup_macro_f = woas.macro_parser.macro_functions.slice(0);
	
	// put away stuff contained in user-defined macro multi-line blocks
	text = text.replace(reMacros, function (str, $1) {
		// ask macro_parser to prepare this block
		var macro = woas.macro_parser($1);
		// allow further parser processing
		if (macro.reprocess)
			return macro.text;
		r = woas.parser.place_holder(snippets.length);
		// otherwise store it for later
		snippets.push(macro.text);
		return r;
	});
	
	// reset the array of custom scripts
	this.script_extension = [];
	if (js_mode) {
		// gather all script tags
		text = text.replace(reScripts, function (str, $1, $2) {
			if (js_mode==2) {
				r = woas.parser.place_holder(snippets.length);
				snippets.push(str);
				return r;
			}
			
			// during safe mode do not activate scripts, transform them to nowiki blocks
			if (js_mode==3) {
				r = woas.parser.place_holder(snippets.length);
				snippets.push( woas._make_preformatted(str) );
				return r;
			}
			var m=$1.match(/src=(?:"|')([^\s'">]+)/);
			if (m!==null)
				woas.parser.script_extension.push(new Array(m[1]));
			else
				woas.parser.script_extension.push($2);
			return "";
		});
	}
	
	// do not parse style blocks
	text = text.replace(reStyles, function(str) {
		r = woas.parser.place_holder(snippets.length);
		snippets.push(str);
		return r;
	});
	
	// put a placeholder for the TOC
	var p = text.indexOf("[[Special::TOC]]");
	if (p != -1) {
		this.has_toc = true;
		text = text.substring(0, p) + "<!-- "+parse_marker+":TOC -->" + text.substring(p+16
//		+ 	((text.charAt(p+16)=="\n") ? 1 : 0)
		);	
	} else this.has_toc = false;

	// put away big enough HTML tags sequences (with attributes)
	text = text.replace(/(<\/?\w+[^>]*>[ \t]*)+/g, function (tag) {
		// save the trailing spaces
		r = woas.parser.place_holder(snippets.length);
		snippets.push(tag);
		return r;
	});

	// wiki tags
	var tags = [],
		inline_tags = 0,
		wl, url;
	
	// links with pipe e.g. [[Page|Title]]
	text = text.replace(reWikiLink, function(str, $1, $2) {
		// check for protocol
		if ($1.search(/^\w+:\/\//)===0) {
			r = woas.parser.place_holder(snippets.length);
			url = $1.replace(/^mailto:\/\//, "mailto:");
			snippets.push("<a title=\""+woas.xhtml_encode(url)+"\" class=\"world\" href=\"" + url + "\" target=\"_blank\">" + $2 + "<\/a>");
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
			r = woas.parser.place_holder(snippets.length);
			if (export_links) {
//						if (this.page_index(page)==-1)
//							wl = " onclick=\"alert('not yet implemented');\"";		else
				wl = " href=\""+woas._export_get_fname(page)+"\"";
			} else
				wl = " onclick=\"go_to('" + woas.js_encode(page) +	"')" + gotohash + "\"";
			snippets.push("<a title=\""+woas.xhtml_encode(page)+"\" class=\"link\""+ wl + " >" + $2 + "<\/a>");
			return r;
		} else {
			// section reference URIs
			if ($1.charAt(0)=="#") {
				r = woas.parser.place_holder(snippets.length);
				if (export_links)
					wl = woas._export_get_fname(page);
				else
					wl = '';
				if (wl == '#')
					snippets.push("<span class=\"broken_link\">" + $2 + "<\/span>");
				else {
					snippets.push("<a title=\""+woas.xhtml_encode(page)+"\" class=\"link\" href=\""+
					wl+"#" +
					woas.parser.header_anchor($1.substring(1)) + "\">" + $2 + "<\/a>");
				}
				return r;
			} else {
				r = woas.parser.place_holder(snippets.length);
				if (export_links) {
					snippets.push("<span class=\"broken_link\">" + $2 + "<\/span>");
					return r;
				}
				wl = " onclick=\"go_to('" +woas.js_encode($1)+"')\"";
				snippets.push("<a title=\""+woas.xhtml_encode(page)+"\" class=\"unlink\" "+wl+">" + $2 + "<\/a>");
				return r;
			}
		}
	}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");

	// links without pipe e.g. [[Page]]
	text = text.replace(reWikiLinkSimple, function(str, $1) {
		// check for protocol
		if ($1.search(/^\w+:\/\//)===0) {
			r = woas.parser.place_holder(snippets.length);
			$1 = $1.replace(/^mailto:\/\//, "mailto:");
			snippets.push("<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>");
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
			r = woas.parser.place_holder(snippets.length);
			if (export_links) {
				wl = woas._export_get_fname($1);
				if (wl == '#') {
					snippets.push("<span class=\"broken_link\">" + $1 + "<\/span>");
					return r;
				}
				wl = " href=\""+wl+"\"";
			} else
				wl = " onclick=\"go_to('" + woas.js_encode($1) +"')\"";
			snippets.push("<a class=\"link\""+wl+">" + $1 + "<\/a>");
			return r;
		} else {
			r = woas.parser.place_holder(snippets.length);
			if ($1.charAt(0)=="#") {
				snippets.push("<a class=\"link\" href=\"#" +woas.parser.header_anchor($1.substring(1)) + "\">" + $1.substring(1) + "<\/a>");
			} else {
				r = woas.parser.place_holder(snippets.length);
				if (export_links) {
					snippets.push("<span class=\"unlink broken_link\">" + $1 + "<\/span>");
					return r;
				}
				wl = " onclick=\"go_to('" + woas.js_encode($1) +"')\"";
				snippets.push("<a class=\"unlink\" "+wl+">" + $1 + "<\/a>");
			}
			return r;
		}
	}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");

	// allow non-wrapping newlines
	text = text.replace(/\\\n/g, "");
	
	// underline
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");
	
	// italics
	// need a space after ':'
	text = text.replace(/(^|[^\w:])\/([^\n\/]+)\//g, function (str, $1, $2) {
		// hotfix for URLs
		if ($2.indexOf("//")!=-1)
			return str;
		return $1+"<em>"+$2+"</em>";
	});
	
	// ordered/unordered lists parsing (code by plumloco)
	text = text.replace(reReapLists, this.parse_lists);
	
	// headers
	//TODO: check that only h1~h6 are parsed
	text = text.replace(reParseHeaders, this.header_replace);
//	text = text.replace(reParseOldHeaders, this.header_replace);
	
	if (this.has_toc) {
		// remove the trailing newline
//		this.toc = this.toc.substr(0, this.toc.length-2);
		// replace the TOC placeholder with the real TOC
		text = text.replace("<!-- "+parse_marker+":TOC -->",
				"<div class=\"woas_toc\"><p class=\"woas_toc_title\">Table of Contents</p>" +
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
	text = text.replace(/(^|\n)\s*\-{3,}[ \t]*(\n|$)/g, "<hr class=\"woas_ruler\" />");
	
	// tables-parsing pass
	if (woas.config.new_tables_syntax)
		text = text.replace(reReapTablesNew, this.parse_tables_new);
	else
		text = text.replace(reReapTables, this.parse_tables);
	
	// cleanup \n after headers and lists
	text = text.replace(/((<\/h[1-6]><div class="woas_level[1-6]">)|(<\/[uo]l>))(\n+)/g, function (str, $1, $2, $3, trailing_nl) {
		if (trailing_nl.length>2)
			return $1+trailing_nl.substr(2);
		return $1;
	});
	
	// remove \n before list start tags
	text = text.replace(/\n(<[uo]l>)/g, "$1");

	// end-trim
//	if (end_trim)
//		text = text.replace(/\s*$/, "");

	// compress newlines characters into paragraphs (disabled)
//	text = text.replace(/\n(\n+)/g, "<p>$1</p>");
//	text = text.replace(/\n(\n*)\n/g, "<p>$1</p>");

	// make some newlines cleanup after pre tags
	text = text.replace(/(<\/?pre>)\n/gi, "$1");

	// convert newlines to br tags
	text = text.replace(/\n/g, "<br />");

	// put back in place all snippets
	if (snippets.length>0) {
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
			return snippets[$1];
		});
	} snippets = null;

	// put back in place all XHTML comments
	if (comments.length>0) {
		text = text.replace(new RegExp("<\\!-- "+parse_marker+":c:(\\d+) -->", "g"), function (str, $1) {
			return comments[$1];
		});
	} comments = null;
	
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
			s+="<a class=\"link\" onclick=\"go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link\" onclick=\"go_to('Tagged::"+woas.js_encode(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"</a>";
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
	// reset the flaggers
	if (this.force_inline)
		this.force_inline = false;
	// restore macros array
	woas.macro_parser.macro_names = backup_macro_n;
	woas.macro_parser.macro_functions = backup_macro_f;
		
	if (text.substring(0,5)!="</div")
		return "<div class=\"woas_level0\">" + text + "</div>";
	return text.substring(6)+"</div>";
};

woas.parser.render_error = function(str, symbol) {
//	if (typeof symbol == "undefined")
//		symbol = "infin";
	symbol = "&"+symbol+";";
	return "<span style=\"color: red;font-weight:bold;\">"+symbol+" "+str+" "+symbol+"</span>";
};
