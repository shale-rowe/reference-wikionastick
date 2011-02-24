// module @parser
woas.parser = {

render_title: null, // title of page being rendered
has_toc: null,
toc: "",
force_inline: false, // stops layout being broken when presenting search results
inline_tags: 0,
_parsing_menu: false, // true when we are parsing the menu page

// properties used by _transclude
_MAX_TRANSCLUSION_RECURSE: 256,
_transcluding: 0,
_snippets: null,
_export_links: null,

// a variety of regular expressions used by the parser
// these REs look for one optional (dynamic) newline
reComments: /<\!--([\s\S]*?)-->([ \t]*\n)?/g,
reMacros: /<<<([\s\S]*?)>>>/g,/*([ \t]*\n)?*/
reNowiki: /\{\{\{([\s\S]*?)\}\}\}([ \t]*\n)?/g,
reScripts: new RegExp("<"+"script([^>]*)>([\\s\\S]*?)<"+"\\/script>([ \t]*\n)?", "gi"),
reStyles: new RegExp("<"+"style([^>]*)>[\\s\\S]*?<"+"\\/style>([ \t]*\n)?", "gi"),
reTransclusion: /\[\[Include::([\s\S]+?)\]\]/g,/*([ \t]*\n)?*/
// REs without optional newline search
// stops automatic br tag generation for listed tags
reBlkHtml: /<\/?(p|div|br|h[1-6r]|[uo]l|li|table|t[rhd]|tbody|thead|center)[\/> \t]/i,
reBoldSyntax: /([^\w\/\\])\*([^\*\n]+)\*/g,
reDry: /(\{\{\{[\s\S]*?\}\}\}|<<<[\s\S]*?>>>|<\!--[\s\S]*?-->)/g,
reHasDNL: /^([ \t]*\n)/,
// DEPRECATED "!" syntax is supported but will be removed soon
reHeading: /^([\!=]{1,6})\s*(.*)$/gm,
reHeadingNormalize: /[^a-zA-Z0-9]/g,
reHtml: /((<\/?\w.*?>[ \t]*)+)(\n)?/g,
reListReap: /^([\*#@])[ \t].*(?:\n\1+[ \t].+)*/gm,
reListItem: /^([\*#@]+)[ \t]([^\n]+)/gm,
reMailto: /^mailto:\/\//,
// tags that can have an optional newline before before/after them
reNewlineBefore: /\n(<[uo]l.*?>)/g,
reNewlineAfter: /(<\/h[1-6]>|<\/[uo]l>)(\n+)/g,
reReapTablesNew: /^\{\|(.*)((?:\n\|.*)*)$/gm,
reReapTablesNewSub1: /\n\|([+ \t-\|])(.*)/g,
reReapTablesNewSub2: /(\|\|)(\s{0,1})(\s?)(?=\|\|)/g,
reReapTablesNewSub3: /(\|\|\s*)$/,
reReapTablesNewSub4: /\|\|\t/g,
reReapTablesNewSub5: /\t\|\|/g,
reReapTablesHead: /^(\s*)(?:(=+)\s*)?(.*?)(\s*)$/,
// rulers with 3 hyphens DEPRECATED (should be 4 or more: ----)
// only white space is allowed before/after the hyphens
reRuler: /^[ \t]*\-{3,}[ \t]*$/gm,
reWikiLink: /\[\[(.*?)(?:\|(.*?))??\]\]/g,

sTOC: "[[Special::TOC]]",

// xhtml output strings
_HR: "<"+"hr class=\"woas_ruler\" />",

// extract the wiki tags from a wiki URL
_get_tags: function(text, last_tag) {
	var tags = [];
	// remove the starting part
	if (text.substr(0, 5) === "Tag::")
		text = woas.trim(text.substring(5));
	else if (text.substr(0,6)==="Tags::") {
		woas.log("Using deprecated 'Tags' namespace");
		text = woas.trim(text.substring(6));
	} else // not a valid tagging
		return tags;
	// check length only after having removed the part we don't need
	if (!text.length)
		return tags;
	var alltags = this.split_tags(text), tag;
	if (last_tag !== null) alltags = alltags.concat(this.split_tags(last_tag));
	for(var i=0;i < alltags.length;i++) {
		tag = woas.trim(alltags[i]);
		if (tags.indexOf(tag)===-1)
			tags.push(tag);
	}
	return tags;
},

_init: function() {
	this.marker = _random_string(3) + ";:;" + _random_string(3);
	this.reBaseSnippet = new RegExp(this.marker + "(\\d+);", "g");
	this.NL_MARKER = this.marker + "NL";
	this.NL_MARKER_NL = this.NL_MARKER + "\n";
	this.reNL_MARKER = new RegExp(this.marker + "NL(\\n)?", "g");
},

// create a preformatted block ready to be displayed
_make_preformatted: function(text, add_style) {
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
},

_raw_preformatted: function(tag, text, cls, add_style) {
	if (typeof add_style != "undefined")
		add_style = " style=\"" + add_style + "\"";
	else add_style = "";
	return "<" + tag + " class=\"" + cls + "\"" + add_style + ">"
		+ woas.xhtml_encode(text) + "</" + tag + ">";
},

// render a single wiki link
_render_wiki_link: function(target, label, snippets, tags, export_links) {
	if (label === undefined) label = '';
	var page = woas.title_unalias(target), // apply aliases to page title
		hashloc = page.indexOf('#'),
		r_label = (label === '') ? page : label,
		title = '', gotohash = '', str, wl,
		// class, title, other attributes (escape '), label
		sLink = '<'+'a class="%s" title="%s"%s>%s<'+'\/a>',
		sLinkBroken = '<'+'span class="woas_broken_link">%s<'+'\/span>',
		scWorld = 'woas_world_link', scWoas = 'woas_link', scWoasUn = 'woas_unlink',
		sHref = ' href="%s"', sHrefTrgt = ' href="%s" target="_blank"',
		sOnClick = ' onclick="woas.go_to(\'%s\')%s"',
		sWindowHash = '; window.location.hash="%s"';

	// check for tag definitions if they might exist
	if (page.match('Tag') && typeof tags === 'object') {
		var found_tags = this._get_tags(page, label);
		if (found_tags.length > 0) {
			// do not use concat because 'tags' is passed byref
			for(var i = 0, it = found_tags.length; i < it; ++i) {
				tags.push(found_tags[i]);
			}
			if (!this.force_inline)
				return '';
			++this.inline_tags;
			return woas.parser.marker + 'T' + inline_tags + ';';
		}
	}

	// check for protocol links
	if (page.match(/^\w+:\/\//)) {
		// convert mailto:// to mailto:
		page = page.replace(this.reMailto, 'mailto:');
		// always give title attribute
		str = sLink.sprintf(scWorld, woas.xhtml_encode(page), sHrefTrgt.sprintf(page), r_label);
		return woas.parser.place_holder(snippets, str);
	}

	// create section heading info
	if (hashloc > 0) {
		if (export_links)
			gotohash = page.substr(hashloc);
		else
			gotohash = sWindowHash.sprintf(page.substr(hashloc));
		page = page.substr(0, hashloc);
	}

	// create a title attribute only when page URI differs from page title
	if (label !== '') {
		title = woas.xhtml_encode(page);
	}

	if (hashloc === 0) { // section reference URIs
		str = sLink.sprintf(scWoas, title, sHref.sprintf(page), r_label);
	} else if (woas.page_exists(page)) { // normal page
		if (export_links) {
			wl = woas.exporter._get_fname(page);
			if (wl === '#') {
				return woas.parser.place_holder(snippets, sLinkBroken.sprintf(r_label));
			}
			wl = sHref.sprintf(wl);
		} else
			wl = sOnClick.sprintf(woas.js_encode(page), gotohash);
		str = sLink.sprintf(scWoas, title, wl, r_label);
	} else { // page does not exist
		if (export_links) {
			str = sLinkBroken.sprintf(r_label);
		} else {
			wl = sOnClick.sprintf(woas.js_encode(page), ''); // gotohash = ''
			str = sLink.sprintf(scWoasUn, title, wl, r_label);
		}
	}
	return woas.parser.place_holder(snippets, str);
},

_transclude: function (str, $1, dynamic_nl) {
	var that = woas.parser,
		parts = $1.split("|"),
		templname = parts[0],
		is_emb = false, ns = woas.get_namespace(templname, true),
		// temporary page object
		P = { body: null };
	//woas.log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
	if (woas.is_reserved(templname) || (templname.substring(templname.length - 2) === "::"))
		P.body = woas.get_text_special(templname);
	else {
		var epi = woas.page_index(templname);
		// offer a link for uploading, to implement feature as before 0.11.0
		if (epi == -1)
			P.body = "[<!-- -->[Include::[["+templname+"]]]]";
		else {
			P.body = woas.get__text(epi);
			is_emb = woas.is_embedded(templname);
		}
	}
	// template retrieval error
	if (P.body === null) {
		// show an error with empty set symbol
		return woas.parser.place_holder(that._snippets, woas.parser.render_error(str, "#8709"), dynamic_nl);
	}
	// increase transclusion depth
	++that._transcluding;
	// add the inline file/image if embedded 
	if (is_emb) {
	//woas.log("Embedded file transclusion: "+templname);	// log:0
		if (woas.is_image(templname)) {
			var img, img_name = woas.xhtml_encode(templname.substr(templname.indexOf("::")+2));
			if (woas.parser._export_links) {
				// check that the URI is valid
				var uri=woas.exporter._get_fname(templname);
				if (uri == '#')
					img = woas.parser.render_error(templname, "#8709");
				else
					img = "<" + "img class=\"woas_embedded\" src=\"" + uri + "\" alt=\"" + img_name + "\" ";
			} else
				img = "<" + "img class=\"woas_embedded\" src=\"" + P.body + "\" ";
			if (parts.length > 1) {
				img += parts[1];
				// always add the alt attribute to images
				if (!woas.parser._export_links && !parts[1].match(/alt=('|").*?\1/))
					img += " alt=\"" + img_name + "\"";
			}
			P.body = img + " />";
		} else { // embedded file but not image
			if ((parts.length > 1) && (parts[1] == "raw"))
				P.body = woas.base64.decode(P.body);
			else
				P.body = "<"+"pre class=\"woas_embedded\">"+
						woas.xhtml_encode(woas.base64.decode(P.body))+"<"+"/pre>";
		}
		P.body = woas.parser.place_holder(that._snippets, P.body, dynamic_nl);
	} else { // not embedded
		// process nowiki, macros, and XHTML comments
		that.pre_parse(P, that._snippets);
		// finally replace transclusion parameters
		if (parts.length) {
			P.body = P.body.replace(/%\d+/g, function(str) {
				var paramno = parseInt(str.substr(1));
				return paramno < parts.length ? parts[paramno] : str;
			});
		}
		// add the previous dynamic newline
		if (typeof dynamic_nl != "undefined" && dynamic_nl !== "")
			P.body += that.NL_MARKER_NL;
	}
	--that._transcluding;
	return P.body;
},

// @override to apply some further customization before parse output
after_parse: function(P) {
},

// remove comment/nowiki/macro blocks while renaming pages (no dynamic newlines)
dry: function(P, NP, snippets) {
	NP.body = P.body.replace(this.reDry, function (str) {
		return woas.parser.place_holder(snippets, str);
	});
},

// @override to parse further syntax before final replace
extend_syntax: function(P) {
},

heading_anchor: function(s) {
	// apply a hard normalization
	// WARNING: will not preserve heading ids uniqueness
	// PVHL: why not use encodeURIComponent here instead?
	return s.replace(this.reHeadingNormalize, '_')
},

heading_replace: function(str, $1, $2) {
	// can't use 'that = this' because called as a function parameter
	var heading = $2, len = $1.length,
		// remove the mirrored heading syntax from right
		hpos = heading.lastIndexOf($1);
	if ((hpos !== -1) && (hpos === heading.length - len))
		heading = heading.substring(0, heading.length - len);
	// automatically build the TOC if needed
	if (woas.parser.has_toc) {
		woas.parser.toc += String("#").repeat(len)+" <"+"a class=\"woas_link\" href=\"#" +
		woas.parser.heading_anchor(heading) + "\">" + heading + "<\/a>\n";
	}
	return "<"+"h"+len+" class=\"woas_heading\" id=\"" + woas.parser.heading_anchor(heading) +
		"\">" + heading + "<"+"/h"+len+">";
},

import_disable: function(NP, js, macros) {
	var that = this, snippets = [];
	// put away nowiki blocks - XHTML comments now allowed in macros
	NP.body = NP.body.replace(this.reNowiki, function (str, $1, dynamic_nl) {
			return that.place_holder(snippets, str, dynamic_nl);
	});
	if (js)
		NP.body = NP.body.replace(this.reScripts, "<"+"disabled_script$1>$2<"+"/disabled_script>$3");
	if (macros)
		NP.body = NP.body.replace(this.reMacros, "<<< Macro disabled\n$1>>>$2");
	// clear dynamic newlines
	NP.body = NP.body.replace(this.reNL_MARKER, "");
	// restore everything
	this.undry(NP, snippets);
	snippets = null;
},

// 'text' is the raw wiki source
// 'export_links' is set to true when exporting wiki pages (used to generate proper href for hyperlinks)
// 'js_mode' controls javascript behavior. Allowed values are:
//    0 - leave script tags as they are (used for exporting)
//    1 - place script tags in head (dynamic),
//    2 - re-add script tags after parsing
//    3 - convert script tags to nowiki blocks
// @override to customize parsing (see also woas.parser.after_parse and woas.pager.browse
parse: function(text, export_links, js_mode) {
	if (woas.config.debug_mode) {
		if ((typeof text).toLowerCase() != "string") {
			woas.crash("Called parse() with invalid argument: "+(typeof text));	// log:1
			return null;
		}
	}
	// default fallback
	if (typeof export_links == "undefined")
		export_links = false;
	if (typeof js_mode == "undefined")
		js_mode = 1;

	var that = this, p, tags = [],
		snippets = [], // HTML markup removed from further parsing
		backup_hook = this.after_parse,
		P = { body: text }; // allow passing text by reference
	text = null;
	
	// process nowiki, macros, and XHTML comments
	this.pre_parse(P, snippets);

	// transclude pages (templates)
	if (!this.force_inline) {
		// reset all groups
		this._ns_groups = { };
		// apply transclusion syntax
		this.transclude_syntax(P, snippets, export_links);
	}
	
	if (js_mode) {
		// reset the array of custom scripts for the correct target
		var script_target = this._parsing_menu ? "menu" : "page";
		woas.scripting.clear(script_target);
		// gather all script tags
		P.body = P.body.replace(this.reScripts, function (str, $1, $2, dynamic_nl) {
			if (js_mode==2) {
				return that.place_holder(snippets, str, dynamic_nl);
			} else if (js_mode==3) {
				// during safe mode do not activate scripts, transform them to nowiki blocks
				return that.place_holder(snippets, that._make_preformatted(str), dynamic_nl);
			} // else
			var m=$1.match(/src=(?:"|')([^\s'">]+)/),
				external = (m!==null);
			woas.scripting.add(script_target, external ? m[1] : $2, external);
			return "";
		});
	}
	
	// take away style blocks
	P.body = P.body.replace(this.reStyles, function(str, $1, dynamic_nl) {
		return that.place_holder(snippets, str, dynamic_nl);
	});
	
	// put a placeholder for the TOC
	p = P.body.indexOf(this.sTOC);
	if (p !== -1) {
		this.has_toc = true;
		P.body = P.body.substring(0, p) + this.marker + "TOC" +
				// dynamic newlines also after TOC
				P.body.substring(p + this.sTOC.length).replace(this.reHasDNL, this.NL_MARKER_NL);
	} else this.has_toc = false;

	// wiki tags
	this.inline_tags = 0;
	
	// static syntax parsing
	this.syntax_parse(P, snippets, tags, export_links, this.has_toc);

	// sort tags at bottom of page, also when showing namespaces
	tags = tags.toUnique().sort();
	if (tags.length && !export_links) {
		var s;
		if (this.force_inline)
			s = "";
		else
			s = "<"+"div class=\"woas_taglinks\">";
		s += "Tags:";
		for(var i=0;i < tags.length;++i) {
			s += " <"+"a class=\"woas_link\" onclick=\"woas.go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+
				woas.xhtml_encode(tags[i])+"<"+"/a>";
		}
		if (this.force_inline) { // re-print the inline tags (works only on last tag definition?)
			P.body = P.body.replace(new RegExp(this.marker + "T(\\d+);", "g"), function (str, $1) {
				// loose comparison is OK here
				if ($1 == that.inline_tags)
					return s;
				return "";
			});
			this.force_inline = false;
		} else {
			s+="<"+"/div>";
			P.body += s;
		}
	}

	if (woas.macro.has_backup())
		// restore macros array
		woas.macro.pop_backup();

	// syntax parsing has finished; apply any final changes
	if (this.after_parse === backup_hook)
		this.after_parse(P);
	
	// finished
	return P.body;
},

// XHTML lists and tables parsing code by plumloco
// There is no limit to the level of nesting and produces valid XHTML markup
// Refactored by PVHL to avoid some string copying and incorporate sublist
parse_lists: function(str, type) {
	function sublist(lst, ll, type) {   
		if (!lst.length)
			return '';
		if (lst[0][1].length > ll)
			return sublist(lst, ll + 1, type);
		var item, subl, s = '';
		while (lst[0][1].length == ll ) {
			item = lst.shift();
			subl = sublist(lst, ll + 1, type);
			if (subl.length)
				s += lst_item.sprintf(item[2] + lst_type[type].sprintf(subl));
			else
				s += lst_item.sprintf(item[2]);
			if (!lst.length)
				break;
		}
		return s;  
	};

	var lst_item = '<'+'li>%s<'+'/li>',
		lst_type = ['<'+'ul>%s<'+'/ul>', '<'+'ol>%s<'+'/ol>', '<'+'ol type="a">%s<'+'/ol>'],
		stk = []; // collect all items in a stack
	type = "*#@".indexOf(type);
	if (type === -1) return; // shouldn't be possible
	str.replace(woas.parser.reListItem, function(str, p1, p2) {
		stk.push([str, p1, p2]);
	});
	return lst_type[type].sprintf(sublist(stk, 1, type));
},

parse_macros: function(P, snippets) {
	// put away stuff contained in user-defined macro multi-line blocks
	P.body = P.body.replace(this.reMacros, function (str, $1, dynamic_nl) {
		if (!woas.macro.has_backup())
			// take a backup copy of the macros, so that no new macros are defined after page processing
			woas.macro.push_backup();

		// ask macro_parser to prepare this block
		var macro = woas.macro.parser($1);
		// allow further parser processing
		if (macro.reprocess) {
			if (typeof dynamic_nl != "undefined" && dynamic_nl!=="")
				macro.text += woas.parser.NL_MARKER_NL;
			return macro.text;
		}
		// otherwise store it for later
		return woas.parser.place_holder(snippets, macro.text, dynamic_nl);
	});
},

// new table parsing by FBNil
parse_tables_new: function (str, prop, p1) {
    var caption = '',
		colgroup = '',
		stk = [],
		cols = [],
		CC = [];
	// variables used by replace callback
	var i, C, CL;
    p1.replace(woas.parser.reReapTablesNewSub1, function (str, pp1, pp2) {
		switch (pp1) {
			case '-': // comment
				return;
			case '+':
				return caption = caption || ('<'+'caption' + (stk.length > 0 ? ' style="caption-side:bottom">' : '>') + pp2 + '<'+'/caption>');
			case '*':
				return colgroup = pp2;
			case '$':
				return CC.push(pp2);
			case '|':
				pp2 = " |" + pp2;
			break;
			case ' ':
				if (pp2.match(/^\|/)) // fix empty first cell
					pp2 = "  " + pp2;
			break;
			default:
				// do not eat the first character if it's not a control character
				pp2 = pp1+pp2;
		}

        var cells = pp2.replace(woas.parser.reReapTablesNewSub2, "$1$2$3  ").
				replace(woas.parser.reReapTablesNewSub3, "$1 ").
				replace(woas.parser.reReapTablesNewSub4, "|| ").
				replace(woas.parser.reReapTablesNewSub5, " ||").split(" || "),
			row = [],
			stag = "",
			cs = 0;
        for (i = cells.length - 1; i >= 0; --i) {
            C = cells[i].match(woas.parser.reReapTablesHead);
            if (i && !C[3] && !C[1] && !C[2]) {
                ++cs;
                continue;
            } else if (i == 0 && !C[3]) C[3] = "&nbsp;";
            CL = C[2] ? C[2].length : 0;
            stag = '<' + (CL == 1 ? 'th' : 'td') + (CL > 1 ? ' ' + CC[CL - 2] || '' : '') + (cs ? ' colspan=' + (++cs) : '') + (C[1] ? ' align=' + (C[4] ? 'center' : 'right') : '') + '>';
            cs = 0;
            row.unshift(stag + C[3] + (CL == 1 ? '<'+'/th>' : '<'+'/td>'));
        }
        stk.push(row.join(""));
    });
    return '<'+'table ' + ((prop.indexOf("class=")!==-1) ? '' : 'class="woas_text_area" ') + prop + '>' + caption + colgroup + '<'+'tr>' + stk.join('<'+'/tr><'+'tr>') + '<'+'/tr>' + '<'+'/table>' + woas.parser.NL_MARKER;
},

/** PVHL:
 * Removed separator as unneeded. nl not preserved as it will be deleted later.
 * Rewrote to perform entire place_holder function here. Will be slightly slower
   but only optimize if truly needed. Rest of code is much simpler this way.
 * Existence of nl needs to be checked for IE so parameter is optional.
*/
place_holder: function (snippets, str, nl) {
	snippets.push(str);
	return woas.parser.marker + (snippets.length - 1) + ";" +
		(nl && nl.length ? this.NL_MARKER_NL : "");
},

// NOTE: XHTML comments can now be contained in nowiki and macro blocks
pre_parse: function(P, snippets) {
	var that = this;
	P.body = P.body.replace(this.reNowiki, function (str, nw, dynamic_nl) {
	// put away stuff contained in nowiki blocks {{{ }}}
	// 'inline' has no breaks at all between the markers. Dealt with by _make_preformatted.
		nw = that._make_preformatted(nw);
		// quick hack to fix disappearing breaks after inline nowiki.
		if (nw.indexOf("t") === 1 && dynamic_nl && dynamic_nl.length)
			nw += "<"+"br/>";
		return that.place_holder(snippets, nw, dynamic_nl);
	});

	this.parse_macros(P, snippets);

	// put away XHTML-style comments
	P.body = P.body.replace(this.reComments, function (str, comment, dynamic_nl) {
		// don't skip anything -- remove all comments for future syntax needs
		return that.place_holder(snippets, str, dynamic_nl);
	});
},

render_error: function(str, symbol) {
	//	if (typeof symbol == "undefined")
	//		symbol = "infin";
	symbol = "&"+symbol+";";
	return "<"+"span style=\"color:red;font-weight:bold;\">"+symbol+" "+str+" "+symbol+"<"+"/span>";
},

// split one or more tags (NOTE: no trim applied)
split_tags: function(tlist) {
	if (tlist.indexOf(",")!==-1)
		return tlist.split(",");
	//DEPRECATED but still supported
	return tlist.split("|");
},

// parse passive syntax only
syntax_parse: function(P, snippets, tags, export_links, has_toc) {
	var that = this;

	// add dynamic newline at start to have consistent newlines for some later syntax regex
	// put away HTML tags and tag sequences (along with attributes)
	P.body = this.NL_MARKER_NL + P.body.replace(this.reHtml, function (str, tags, last, dnl) {
		// stop certain html block tags from having a br tag appended
		if (dnl !== "\n") {
			dnl = "";
		} else if (last.match(that.reBlkHtml)) {
			// dnl is "\n"
			dnl = that.NL_MARKER_NL;
		}
		// could right-trim tags but OK as is I think
		return that.place_holder(snippets, tags) + dnl;
	})

	// render links e.g. [[target]] & [[target|label]]
	.replace(this.reWikiLink, function(str, target, label) {
		if (target)
			return that._render_wiki_link(target, label, snippets, tags, export_links);
		else
			return str; // not a valid link
		})

	// allow non-wrapping newlines
	.replace(/\\\n/g, "")

	// underline
	.replace(/(^|[^\w])_([^_]+)_/g, "$1"+that.marker+"uS#$2"+that.marker+"uE#")

	// italics - need a space after ':'
	.replace(/(^|[^\w:])\/([^\n\/]+)\//g, function (str, $1, $2) {
		// hotfix for URLs
		if ($2.indexOf("//")!=-1)
			return str;
		return $1+"<"+"em>"+$2+"<"+"/em>";
	})

	// ordered/unordered lists parsing (code by plumloco)
	.replace(this.reListReap, this.parse_lists)

	// headings - only h1~h6 are parsed
	.replace(this.reHeading, this.heading_replace);

	// other custom syntax should go into this callback
	this.extend_syntax(P);
	
	// replace [[Special::TOC]]
	if (has_toc) {
		// replace the TOC placeholder with the real TOC
		P.body = P.body.replace(that.marker+"TOC",
				"<"+"div class=\"woas_toc\"><"+"p class=\"woas_toc_title\">Table of Contents<"+"/p>" +
				this.toc.replace(this.reListReap, this.parse_lists) + "<"+"/div>" );
		this.toc = "";
	}

	// use 'strong' tag for bold text
	P.body = P.body.replace(this.reBoldSyntax, "$1"+this.marker+"bS#$2"+this.marker+"bE#")

	.replace(new RegExp(this.marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
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
	})

	// horizontal rulers: multiline RE used; adding NL_MARKER will remove the \n following.
	.replace(this.reRuler, this._HR + this.NL_MARKER)

	// tables-parsing pass (parse_tables & reReapTables are in legacy.js)
	.replace(woas.config.new_tables_syntax ? this.reReapTablesNew : this.reReapTables,
				woas.config.new_tables_syntax ? this.parse_tables_new : this.parse_tables)
	
	// cleanup \n after headings and lists
	.replace(this.reNewlineAfter, function (str, $1, trailing_nl) {
		if (trailing_nl.length > 2)
			return $1 + trailing_nl.substr(2);
		return $1;
	})

	// remove \n before list start tags
	.replace(this.reNewlineBefore, "$1")
	
	// clear dynamic newlines
	.replace(this.reNL_MARKER, "")

	// convert newlines to br tags
	.replace(/\n/g, "<"+"br />");
	
	// put back in place all snippets
	this.undry(P, snippets);	
	snippets = null;
},

//API1.0
//TODO: offer transclusion parameters argument
transclude: function(title, snippets, export_links) {
	this._snippets = snippets;
	this._export_links = export_links ? true : false;
	var rv = this._transclude("[[Include::"+title+"]]", title);
	this._export_links = this._snippets = null;
	return rv;
},

transclude_syntax: function(P, snippets, export_links) {
	var trans_level = 0;
	this._snippets = snippets;
	this._export_links = export_links ? true : false;
	do {
		P.body = P.body.replace(this.reTransclusion, this._transclude);
		// keep transcluding when a transclusion was made and when transcluding depth is not excessive
	} while (++trans_level < this._MAX_TRANSCLUSION_RECURSE);
	if (trans_level === this._MAX_TRANSCLUSION_RECURSE) { // parse remaining inclusions as normal text
		P.body = P.body.replace(this.reTransclusion, function (str, $1, dynamic_nl) {
			return woas.parser.place_holder(snippets, woas.parser.render_error(str, "infin"), dynamic_nl);
		});
	}
	this._snippets = this._export_links = null;
},

// return all the snippets that were pushed to snippets array
undry: function(NP, snippets) {
	if (!snippets.length) return;
	NP.body = NP.body.replace(this.reBaseSnippet, function (str, $1) {
		return snippets[parseInt($1)];
	});
}

}; // end of parser module

// initialize here because IE would fail otherwise
woas.parser._init();
delete woas.parser._init;
