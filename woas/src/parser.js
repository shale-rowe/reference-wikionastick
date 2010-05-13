woas.parser = {
	_MAX_TRANSCLUSION_RECURSE: 256,
	has_toc: null,
	toc: "",
	force_inline: false,		// used not to break layout when presenting search results
	inline_tags: 0,
	_parsing_menu: false,		// true when we are parsing the menu page

	header_anchor: function(s) {
		// apply a hard normalization
		// WARNING: will not preserve header ids uniqueness
		return s.replace(/[^a-zA-Z0-9]/g, '_')
	},
	
	// hook which can be overriden by extensions
	after_parse: function() {
	},
	
	// a variety of regular expressions used by the parser
	reBoldSyntax: /(^|[^\w\/\\])\*([^\*\n]+)\*/g
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
			woas.parser.toc += String("#").repeat(len)+" <"+"a class=\"woas_link\" href=\"#" +
			woas.parser.header_anchor(header) + "\">" + header + "<\/a>\n";
		}
		return "</"+"div><"+"h"+len+" class=\"woas_header\" id=\""+woas.parser.header_anchor(header)+"\">"+header+"<"+"/h"+len+"><"+"div class=\"woas_level"+len+"\">";
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
                    s += '<'+'li>' + item[2] + suoro + subl + euoro + '<'+'/li>' ;
                else
                    s += '<'+'li>' + item[2] + '<'+'/li>';
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
			stk.push('<'+'td>' + pp2.split('||').join('<'+'/td><'+'td>') + '<'+'/td>');
		} 
	);
	return  '<'+'table class="woas_text_area">' +
				(caption?('<'+'caption>' + caption + '<'+'/caption>'):'') +
				'<'+'tr>' + stk.join('<'+'/tr><'+'tr>') + '<'+'/tr>' +
			'<'+'/table>';
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
        if (pp1 == '+') return caption = caption || ('<'+'caption' + (stk.length > 0 ? ' style="caption-side:bottom">' : '>') + pp2 + '<'+'/caption>');
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
            row.unshift(stag + C[3] + (CL == 1 ? '<'+'/th>' : '<'+'/td>'));
        }
        stk.push(row.join(""));
    });
    return '<'+'table ' + ((prop.indexOf("class=")!==-1) ? '' : 'class="woas_text_area" ') + prop + '>' + caption + colgroup + '<'+'tr>' + stk.join('<'+'/tr><'+'tr>') + '<'+'/tr>' + '<'+'/table>'
}

var	parse_marker = "#"+_random_string(8);

// extract the wiki tags from a wiki URL
woas._get_tags = function(text) {
	var tags = [];
	// remove the starting part
	if (text.substr(0, 5) === "Tag::")
		text = this.trim(text.substring(5));
	else if (text.substr(0,6)==="Tags::") {
		woas.log("Using deprecated 'Tags' namespace");
		text = this.trim(text.substring(6));
	} else // not a valid tagging
		return tags;
	// check length only after having removed the part we don't need
	if (!text.length)
		return tags;
	var alltags = this.split_tags(text), tag;
	for(var i=0;i < alltags.length;i++) {
		tag = this.trim(alltags[i]);
		if (tags.indexOf(tag)===-1)
			tags.push(tag);
	}
	return tags;
};

// split one or more tags
// note: no trim applied
woas.split_tags = function(tlist) {
	if (tlist.indexOf(",")!==-1)
		return tlist.split(",");
	//DEPRECATED but still supported
	return tlist.split("|");
};

var reScripts = new RegExp("<"+"script([^>]*)>([\\s\\S]*?)<"+"\\/script>", "gi"),
	reStyles = new RegExp("<"+"style([^>]*)>[\\s\\S]*?<"+"\\/style>", "gi"),
	reNowiki = /\{\{\{([\s\S]*?)\}\}\}/g,
	reTransclusion = /\[\[Include::([\s\S]+?)\]\]/g,
	reMacros = /<<<([\s\S]*?)>>>/g,
	reComments = /<\!--([\s\S]*?)-->/g,
	reWikiLink = /\[\[([^\]\]]*?)\|(.*?)\]\]/g,
	reWikiLinkSimple = /\[\[([^\]]*?)\]\]/g,
	reMailto = /^mailto:\/\//,
	reCleanupNewlines = new RegExp('((<\\/h[1-6]><'+'div class="woas_level[1-6]">)|(<\\/[uo]l>))(\n+)', 'g'),
	reNestedComment = new RegExp("<\\!-- "+parse_marker+":c:(\\d+) -->");

woas.parser.place_holder = function (i, separator) {
	if (typeof separator == "undefined")
		separator = "";
	separator = ":"+separator+":";
	return "<!-- "+parse_marker+separator+i+" -->";
};

// create a preformatted block ready to be displayed
woas._make_preformatted = function(text, add_style) {
	var cls = "woas_nowiki", tag, p = text.indexOf("\n");
	if (p === -1) {
		tag = "tt";
	} else {
		// remove the first newline to be compliant with old parsing
		if (p===0)
			text = text.substr(1);
		cls += " woas_nowiki_multiline";
		tag = "pre";
	}
	return this._raw_preformatted(tag, text, cls, add_style);
};

woas._raw_preformatted = function(tag, text, cls, add_style) {
	var xhtml = this.xhtml_encode(text);
	// convert the newlines - not necessary with pre tags
//	if (this.browser.ie)		xhtml = xhtml.replace(/\n/g, "\r\n");
	// to ease copy/pasting
//	xhtml = xhtml.replace(/\n/g, "<"+"br />");
	if (typeof add_style != "undefined")
		add_style = " style=\""+add_style+"\"";
	else add_style = "";
	return "<"+tag+" class=\""+cls+"\""+add_style+">"+xhtml+"</"+tag+">";
};

// THIS is the method that you should override for your custom parsing needs
// 'text' is the raw wiki source
// 'export_links' is set to true when exporting wiki pages and is used to generate proper href for hyperlinks
// 'js_mode' controls javascript behavior. Allowed values are:
// 0 = leave script tags as they are (used for exporting)
// 1 - place script tags in head (dynamic),
// 2 - re-add script tags after parsing
// 3 - convert script tags to nowiki blocks
woas.parser.parse = function(text, export_links, js_mode) {
	if (woas.config.debug_mode) {
		if ((typeof text).toLowerCase() != "string") {
			log("Called parse() with bad text!");	// log:1
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
	
	// put away XHTML-style comments
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
			$1 = $1.replace(reNestedComment, function (str, $1) {
				var c=comments[$1];
				comments[$1] = null;
				return c;
			});
		}
		snippets.push(woas._make_preformatted($1));
		return r;
	});

	// take a backup copy of the macros, so that no new macros are defined after page processing
	woas.macro.push_backup();
	
	// put away stuff contained in user-defined macro multi-line blocks
	text = text.replace(reMacros, function (str, $1) {
		// ask macro_parser to prepare this block
		var macro = woas.macro.parser($1);
		// allow further parser processing
		if (macro.reprocess)
			return macro.text;
		r = woas.parser.place_holder(snippets.length);
		// otherwise store it for later
		snippets.push(macro.text);
		return r;
	});
	
	// transclude pages (templates)
	if (!this.force_inline) {
		// reset all groups
		this._ns_groups = { };
		var trans_level = 0, trans;
		do {
			trans = 0;
			text = text.replace(reTransclusion, function (str, $1) {
				var parts = $1.split("|"),
					templname = parts[0],
					is_emb = false, templtext, ns=woas.get_namespace(templname, true);
//				log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
				// in case of embedded file, add the inline file or add the image
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
							var uri=woas.exporter._get_fname(templname);
							if (uri == '#')
								img = woas.parser.render_error(templname, "#8709");
							else
								img = "<"+"img class=\"woas_embedded\" src=\""+uri+"\" alt=\""+img_name+"\" ";
						} else
							img = "<"+"img class=\"woas_embedded\" src=\""+templtext+"\" ";
						if (parts.length>1) {
							img += parts[1];
							// always add the alt attribute to images
							if (!export_links && !parts[1].match(/alt=('|").*?\1/))
								img += " alt=\""+img_name+"\"";
						}
						snippets.push(img+" />");
					} else { // embedded file but not image
						if ((parts.length>1) && (parts[1]=="raw"))
							snippets.push(woas.base64.decode(templtext));
						else
							snippets.push("<"+"pre class=\"woas_embedded\">"+
									woas.xhtml_encode(woas.base64.decode(templtext))+"<"+"/pre>");
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
							$1 = $1.replace(reNestedComment, function (str, $1) {
								var c=comments[$1];
								comments[$1] = null;
								return c;
							});
						}
						snippets.push(woas._make_preformatted($1));
						return r;
					});

					// put away stuff contained in user-defined macro multi-line blocks
					text = text.replace(reMacros, function (str, $1) {
						// ask macro_parser to prepare this block
						var macro = woas.macro.parser($1);
						// allow further parser processing
						if (macro.reprocess)
							return macro.text;
						r = woas.parser.place_holder(snippets.length);
						// otherwise store it for later
						snippets.push(macro.text);
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
		} while (trans && (++trans_level < this._MAX_TRANSCLUSION_RECURSE));
		if (trans_level === this._MAX_TRANSCLUSION_RECURSE) { // parse remaining inclusions as normal text
			text = text.replace(reTransclusion, function (str) {
				r = woas.parser.place_holder(snippets.length);
				snippets.push(woas.parser.render_error(str, "infin"));
				return r;
			});
		}
	}
	
	var	backup_hook = this.after_parse;
	
	if (js_mode) {
		// reset the array of custom scripts for the correct target
		var script_target = this._parsing_menu ? "menu" : "page";
		woas.scripting.clear(script_target);
		// gather all script tags
		text = text.replace(reScripts, function (str, $1, $2) {
			if (js_mode==2) {
				r = woas.parser.place_holder(snippets.length);
				snippets.push(str);
				return r;
			} else if (js_mode==3) {
				// during safe mode do not activate scripts, transform them to nowiki blocks
				r = woas.parser.place_holder(snippets.length);
				snippets.push( woas._make_preformatted(str) );
				return r;
			} // else
			var m=$1.match(/src=(?:"|')([^\s'">]+)/),
				external = (m!==null);
			woas.scripting.add(script_target, external ? m[1] : $2, external);
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
	if (p !== -1) {
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
		wl, url;
	this.inline_tags = 0;
	
	// links with pipe e.g. [[Page|Title]]
	text = text.replace(reWikiLink, function(str, $1, $2) {
		return woas.parser._render_wiki_link($1, $2, snippets, tags, export_links);
	});

	// links without pipe e.g. [[Page]]
	text = text.replace(reWikiLinkSimple, function(str, $1) {
		return woas.parser._render_wiki_link($1, null, snippets, tags, export_links);
	});
	
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
		return $1+"<"+"em>"+$2+"<"+"/em>";
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
				"<"+"div class=\"woas_toc\"><"+"p class=\"woas_toc_title\">Table of Contents<"+"/p>" +
				this.toc.replace(reReapLists, this.parse_lists)
				/*.replace("\n<", "<") */
				+ "<"+"/div>" );
		this.toc = "";
	}
	
	// use 'strong' tag for bold text
	text = text.replace(this.reBoldSyntax, "$1"+parse_marker+"bS#$2"+parse_marker+"bE#");

	text = text.replace(new RegExp(parse_marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
		if ($2=='E') {
			if ($1=='u')
				return "<"+"/span>";
			return "<"+"/strong>";
		}
		if ($1=='u')
			tag = "<"+"span style=\"text-decoration:underline;\">";
		else
			tag = "<"+"strong>";
		return tag;
	});

	// 'hr' horizontal rulers made with 3 hyphens, 4 suggested
	// only white spaces are allowed after the hyphens
	text = text.replace(/(^|\n)\s*\-{3,}[ \t]*(\n|$)/g, "<"+"hr class=\"woas_ruler\" />");
	
	// tables-parsing pass
	if (woas.config.new_tables_syntax)
		text = text.replace(reReapTablesNew, this.parse_tables_new);
	else
		text = text.replace(reReapTables, this.parse_tables);
	
	// cleanup \n after headers and lists
	text = text.replace(reCleanupNewlines, function (str, $1, $2, $3, trailing_nl) {
		if (trailing_nl.length>2)
			return $1+trailing_nl.substr(2);
		return $1;
	});
	
	// remove \n before list start tags
	text = text.replace(/\n(<[uo]l>)/g, "$1");

	// end-trim
//	if (end_trim)
//		text = text.replace(/\s*$/, "");

	// make some newlines cleanup after pre tags
	text = text.replace(/(<\/?pre>)\n/gi, "$1");

	// convert newlines to br tags
	text = text.replace(/\n/g, "<"+"br />");

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
			s = "<"+"div class=\"woas_taglinks\">";
		s += "Tags: ";
		for(var i=0;i < tags.length-1;i++) {
			s+="<"+"a class=\"woas_link\" onclick=\"woas.go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+tags[i]+"<"+"/a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<"+"a class=\"woas_link\" onclick=\"woas.go_to('Tagged::"+woas.js_encode(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"<"+"/a>";
		if (!this.force_inline) {
			s+="<"+"/div>";
			text += s;
		} else { // re-print the inline tags (works only on last tag definition?)
			text = text.replace(new RegExp("<\\!-- "+parse_marker+":(\\d+) -->", "g"), function (str, $1) {
				if ($1 == inline_tags)
					return s;
				return "";
			});
		}
	}
	// reset the flaggers
	if (this.force_inline)
		this.force_inline = false;
	// restore macros array
	woas.macro.pop_backup();

	// trigger after_parse hook only when not defining any
	if (this.after_parse === backup_hook) {
		// 'text' can't yet be passed here (needs referenced objects)
		this.after_parse();
	}
		
	if (text.substring(0,5)!=="<"+"/div")
		return "<"+"div class=\"woas_level0\">" + text + "<"+"/div>";
	// complete
	return text.substring(6)+"<"+"/div>";
};

// render a single wiki link
woas.parser._render_wiki_link = function(arg1, label, snippets, tags, export_links) {
	// apply aliases to page title
	var page = woas.title_unalias(arg1),
		hashloc = page.indexOf("#"),
		gotohash = "", r,
		r_label = (label === null) ? page : label;

	// check for protocol links
	if (page.search(/^\w+:\/\//)===0) {
		r = woas.parser.place_holder(snippets.length);
		// convert mailto:// to mailto:
		page = page.replace(reMailto, "mailto:");
		// always give title attribute
		snippets.push("<"+"a title=\""+woas.xhtml_encode(page)+"\" class=\"woas_world_link\" href=\"" + page +
			"\" target=\"_blank\">" + r_label + "<\/a>");
		return r;
	}
	
	// check for tags definitions
	var found_tags = woas._get_tags((label === null) ? page : page+","+label);
	if (found_tags.length > 0) {
		// do not use concat because 'tags' is passed byref
		for(var i=0,it=found_tags.length;i<it;++i) {
			tags.push(found_tags[i]);
		}
		if (!this.force_inline)
			return "";
		++this.inline_tags;
		return "<!-- "+parse_marker+":"+inline_tags+" -->";
	}

	if (hashloc > 0) {
		if (export_links)
			gotohash = page.substr(hashloc);
		else
			gotohash = "; window.location.hash= \"" + page.substr(hashloc) + "\"";
		page = page.substr(0, hashloc);
	}

	// get a snippet id which we will later fill
	r = woas.parser.place_holder(snippets.length);
	// create a title attribute only when page URI differs from page title
	var _c_title = (page !== label) ? ' title="'+woas.xhtml_encode(page)+'"' : '';
	if (hashloc === 0) { // section reference URIs
		snippets.push("<"+"a"+_c_title+" class=\"woas_link\" href=\""+page+"\">" + r_label + "<\/a>");
	} else { // normal pages
		if (woas.page_exists(page)) {
			if (export_links) {
				wl = woas.exporter._get_fname(page);
				if (wl === '#') {
					snippets.push("<"+"span class=\"woas_broken_link\">" + r_label + "<\/span>");
					return r;
				}
				wl = " href=\""+wl+"\"";
			} else
				wl = " onclick=\"woas.go_to('" + woas.js_encode(page) +"')"+gotohash+"\"";
			snippets.push("<"+"a"+_c_title+" class=\"woas_link\""+wl+">" + r_label + "<\/a>");
		} else { // unexisting pages
			if (export_links) {
				snippets.push("<"+"span class=\"woas_broken_link\">" + r_label + "<\/span>");
			} else {
				wl = " onclick=\"woas.go_to('" +woas.js_encode(page)+"')\"";
				snippets.push("<"+"a"+_c_title+" class=\"woas_unlink\" "+wl+">" + r_label + "<\/a>");
			}
		}
	} // not # at start of page
	return r;
};

woas.parser.render_error = function(str, symbol) {
//	if (typeof symbol == "undefined")
//		symbol = "infin";
	symbol = "&"+symbol+";";
	return "<"+"span style=\"color: red;font-weight:bold;\">"+symbol+" "+str+" "+symbol+"<"+"/span>";
};
