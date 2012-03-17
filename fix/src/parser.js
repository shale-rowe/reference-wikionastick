// module @parser
woas.parser = {

render_title: null, // title of page being rendered
export_links: false, // true if exporter active
has_toc: null,
toc: [],
force_inline: false, // stops layout being broken when presenting search results
inline_tags: 0,
_parsing_menu: false, // true when we are parsing the menu page

// properties used by _transclude
_MAX_TRANSCLUSION_RECURSE: 256,
_transcluding: 0,
_snippets: null,

// a variety of regular expressions used by the parser

// these REs look for one optional (dynamic) newline at the end
reComments: /<\!--([\s\S]*?)-->([ \t]*\n)?/g,
reMacros: /<{2,3}([\s\S]*?)>{2,3}([ \t]*\n)?/g,
reNowiki: /\{\{\{([ \t]*\n)?([\s\S]*?)(\n[ \t]*)?\}\}\}([ \t]*\n)?/g,
reScripts: new RegExp("<"+"script([^>]*)>([\\s\\S]*?)<"+"\\/script>([ \\t]*\\n)?", "gi"),
reStyles: new RegExp("<"+"style([^>]*)>[\\s\\S]*?<"+"\\/style>([ \\t]*\\n)?", "gi"),
reTOC: /\[\[Special::TOC\]\]([ \t]*\n)?/,

// REs without optional newline search
// reAutoLinks finds sequences that look like URLs (x://)
reAutoLinks: /(?:(https?|ftp|file)|[a-zA-Z]+):\/\/(?:[^\s]*[^\s*.;,:?!\)\}\]])*/g,
// stops automatic br tag generation for listed tags
reBlkHtml: /^(p|div|br|blockquote|[uo]l|li|table|t[rhd]|tbody|thead|h[1-6r]|center)$/i,
reDry: /(\{\{\{[\s\S]*?\}\}\}|<{2,3}[\s\S]*?>{2,3}|<\!--[\s\S]*?-->)/g,
reHasDNL: /^([ \t]*\n)/,
// DEPRECATED "!" syntax is supported but will be removed soon
reHeading: /^([\!=]{1,6})[ \t]*(.*?)[ \t]*(?:\1?)$/gm,
reHtml: /([ \t]*)((?:(?:[ \t]*)?<\/?([^<\/\s>]+)[^<>]*>)+)([ \t]*\n)?/g,
reListReap: /^([\*#@])[ \t].*(?:\n\1+[ \t].+)*/gm,
reListItem: /^([\*#@]+)[ \t]([^\n]+)/gm,
// tags that can have an optional newline before before/after them
reNewlineBefore: /\n(<(?:[uo]l).*?>)/g,
reNewlineAfter: /(<\/(?:h[1-6]|[uo]l)>)\n/g,
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
reTransclusion: /\[\[Include::([\s\S]+?)\]\]/g,
reWikiLink: /\[\[(.*?)(?:\|(.*?))??\]\]/g,

// xhtml output strings
_HR: "<"+"hr class=\"woas_ruler\" />",

// extract the wiki tags from a wiki URL
_get_tags: function(text, last_tag) {
	var tags = [];
	// remove the starting part
	if (text.substr(0, 5) === "Tag::")
		text = woas.trim(text.substring(5));
	else if (text.substr(0,6)==="Tags::") {
//		woas.log("Using deprecated 'Tags' namespace");
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
		if (tag.length && tags.indexOf(tag) === -1)
			tags.push(tag);
	}
	return tags;
},

_init: function() {
	this.marker = _random_string(3) + ":" + _random_string(3);
	this.reBaseSnippet = new RegExp(this.marker + "(\\d+);", "g");
	this.NL_MARKER = this.marker + "NL;";
	this.reNL_MARKER = new RegExp(this.marker + "NL;([ \\t]*\\n)?", "g");
},

// create a preformatted block ready to be displayed
_make_preformatted: function(text, add_style) {
	var cls, tag, p = text.indexOf("\n");
	if (p !== -1) {
		// remove the first newline to be compliant with old parsing
		if (p === 0) { text = text.substr(1); }
		cls = " woas_nowiki_multiline";
		tag = "pre";
	} else {
		cls = "woas_nowiki";
		tag = "tt";
	}
	return this._raw_preformatted(tag, text, cls, add_style);
},

_raw_preformatted: function(tag, text, cls, add_style) {
	add_style = add_style ? ' style="' + add_style + '"' : '';
	// PVHL: IE can't do pre without windows newlines
	if (woas.browser.ie) {
		text = text.replace(/\n/g, '\r\n');
	} else {
	}
	return "<" + tag + " class=\"" + cls + "\"" + add_style + ">" +
		woas.xhtml_encode(text) + "</"+tag+">";
},

// render a single wiki link
_render_wiki_link: function(target, label, snippets, tags) {
	if (label === undefined) {
		label = '';
	}
	var r_label, hashloc,
		page = woas.title_unalias(target), // unalias page title
		title = '', gotohash = '', str, wl, pg,
		sLink = '<'+'a class="%s" title="%s"%s>%s<'+'\/a>',
		sLinkBroken = '<'+'span class="woas_broken_link">%s<'+'\/span>',
		scWorld = 'woas_world_link', scWoas = 'woas_link', scWoasUn = 'woas_unlink',
		sHref = ' href="%s"', sHrefTrgt = ' href="%s" target="_blank"',
		sOnClick = ' onclick="woas.go_to(\'%s\')"';

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
			return this.marker + 'T' + inline_tags + ';';
		}
	}

	// real link found; fix page (Javascript::)
	if (snippets.length) {
		page = page.replace(this.reBaseSnippet, function (str, $1) {
			return snippets[parseInt($1)];
		});
	}
	hashloc = page.indexOf('#');
	if (label === '') {
		r_label = page;
	} else {
		// fix label formatting. Labels can now have HTML, nowiki, and macros in them!
		if (snippets.length) {
			label = label.replace(this.reBaseSnippet, function (str, $1) {
				return snippets[parseInt($1)];
			});
		}
		label = label.replace(this.reNL_MARKER, "");
		r_label = label;
	}

	// check for protocol links
	if (page.match(/^\w+:\/\//)) {
		// convert mailto:// to mailto:
		page = page.replace(/^mailto:\/\//, 'mailto:');
		// always give title attribute
		str = sLink.sprintf(scWorld, woas.xhtml_encode(page), sHrefTrgt.sprintf(page), r_label);
		return this.place_holder(snippets, str);
	}

	// create section heading info
	if (hashloc !== -1) {
		gotohash = this.heading_anchor(page.substr(hashloc + 1), true);
		pg = page.substr(0, hashloc);
	} else {
		pg = page;
	}
	if (!pg && !gotohash || /"/.test(pg)) {
		// PVHL: " will break link - current code does not allow.
		//  empty link - [[#]] ?
		return this.place_holder(snippets,
			'[[<'+'span style="color:#f00">'+target+'<'+'/span>'+
			(label ? '|'+label : '')+']]');
	}
	// create a title attribute only when page URI differs from page title
	if (label !== '' || gotohash) {
		title = woas.xhtml_encode(page);
	}

	if ((!pg && gotohash) || woas.page_exists(pg)) { // normal page
		if (this.export_links) {
			wl = pg ? woas.exporter._get_fname(pg) : '';
			if (wl === '#') {
				return this.place_holder(snippets, sLinkBroken.sprintf(r_label));
			}
			wl = sHref.sprintf(wl + (gotohash ? '#' + gotohash : ''));
		} else {
			wl = sOnClick.sprintf(woas.js_encode(pg) + (gotohash ? '#' + woas.js_encode(gotohash) : ''));
		}
		str = sLink.sprintf(scWoas, title, wl, r_label);
	} else { // page does not exist
		if (this.export_links) {
			str = sLinkBroken.sprintf(r_label);
		} else {
			wl = sOnClick.sprintf(woas.js_encode(pg));
			str = sLink.sprintf(scWoasUn, title, wl, r_label);
		}
	}
	return this.place_holder(snippets, str);
},

_transclude: function (str, $1, img_gallery) {
	var that = woas.parser,
		parts = $1.split("|"),
		templname = parts[0],
		is_emb = false, ns = woas.get_namespace(templname, true),
		// temporary page object
		P = { body: null };
	//woas.log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
	// increase transclusion depth (used by namespace listing)
	++that._transcluding;
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
		--that._transcluding;
		if (img_gallery) {
			// stop double message for encrypted image
			return that.place_holder(that._snippets, that.render_error('[<!-- -->'
				+str.substr(1), "#8709")+'\n');
		}
		// show an error with empty set symbol
		return that.place_holder(that._snippets, that.render_error(str, "#8709"));
	}
	// add the inline file/image if embedded
	if (is_emb) {
	//woas.log("Embedded file transclusion: "+templname);	// log:0
		if (woas.is_image(templname)) {
			var img, img_name = woas.xhtml_encode(templname.substr(templname.indexOf("::")+2)),
				img_cls;
			img_cls = img_gallery ? 'woas_img_list' : 'woas_img';
			if (that.export_links) {
				// check that the URI is valid
				var uri=woas.exporter._get_fname(templname);
				if (uri == '#')
					img = that.render_error(templname, "#8709");
				else
					img = "<" + "img class=\""+img_cls+"\" src=\"" + uri + "\" alt=\"" + img_name + "\" ";
			} else
				img = "<" + "img class=\""+img_cls+"\" src=\"" + P.body + "\" ";
			if (parts.length > 1) {
				img += parts[1];
				// always add the alt attribute to images
				if (!that.export_links && !parts[1].match(/alt=('|").*?\1/))
					img += " alt=\"" + img_name + "\"";
			}
			P.body = img + " />";
		} else { // embedded file but not image
			if ((parts.length > 1) && (parts[1] == "raw"))
				P.body = woas.base64.decode(P.body);
			else
				P.body = "<"+"div class=\"woas_embedded\">"+
						woas.xhtml_encode(woas.base64.decode(P.body))+"<"+"/div>";
		}
		P.body = that.place_holder(that._snippets, P.body);
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


// Create a W3C-spec-legal ID from heading using quick & simple hash.
// The same string produces the same hash, so headings need to be unique
//   or the first match will be moved to (could add editor alert).
// 's' is heading text; should not be empty, straight unicode text - no HTML
// 'check' (optional) forces test for already transformed anchor
heading_anchor: function(s, check) {
	if (!s || check && /^S\d+$/.test(s)) {
		return s;
	}
	var id = 0, i = 0, il;
	for (il = s.length; i < il;) {
		id += s.charCodeAt(i) * ++i;
	}
	return 'S' + id;
},

import_disable: function(NP, js, macros) {
	var that = this, snippets = [];
	// put away nowiki blocks - XHTML comments now allowed in macros
	NP.body = NP.body.replace(this.reNowiki, function (str, $1, dynamic_nl) {
			return that.place_holder_dnl(snippets, str, dynamic_nl);
	});
	if (js)
		NP.body = NP.body.replace(this.reScripts, "<"+"disabled_script$1>$2<"+"/disabled_script>$3");
	if (macros) {
		NP.body = NP.body.replace(this.reMacros, function(str, $1, $2) {
			if (typeof $1 === 'undefined') { $1 = ''; } // IE
			if (typeof $2 === 'undefined') { $2 = ''; }
			return '<< Macro disabled\n' + $1 + '>>' + $2;
		});
	}
	// clear dynamic newlines
	NP.body = NP.body.replace(this.reNL_MARKER, "");
	// restore everything
	this.undry(NP, snippets);
	snippets = null;
},

// 'text' is the raw wiki source
// 'js_mode' controls javascript behavior. Allowed values are:
//    0 - leave script tags as they are (used for exporting; acts much like mode 2)
//    1 - place script tags in head (dynamic),
//    2 - re-add script tags after parsing
//    3 - convert script tags to nowiki blocks
// @override to customize parsing (see also woas.parser.after_parse and woas.pager.browse
parse: function(text, js_mode) {
	if (woas.config.debug_mode) {
		if ((typeof text).toLowerCase() != "string") {
			woas.crash("Called parse() with invalid argument: "+(typeof text));	// log:1
			return null;
		}
	}
	// default fallback
	if (typeof js_mode == "undefined")
		js_mode = 1;

	var that = this, pLength, tags = [],
		snippets = [], // HTML markup removed from further parsing
		backup_hook = this.after_parse,
		P = { body: text }; // allow passing text by reference
	text = null;

	// make a backup copy of current macros, so no new macros remain after page processing
	woas.macro.make_backup();

	// process nowiki, macros, and XHTML comments
	this.pre_parse(P, snippets);

	// transclude pages (templates)
	if (!this.force_inline) {
		// apply transclusion syntax
		this.transclude_syntax(P, snippets);
	}

	// PVHL: code was breaking exported scripts by adding br tags; refactored
	if (js_mode) {
		// reset the array of custom scripts for the correct target
		var script_target = this._parsing_menu ? "menu" : "page";
		woas.scripting.clear(script_target);
	}
	// gather all script tags
	P.body = P.body.replace(this.reScripts, function (str, $1, $2, dynamic_nl) {
		if (js_mode === 0 || js_mode === 2) {
			return that.place_holder_dnl(snippets, str, dynamic_nl);
		} else if (js_mode === 3) {
			// during safe mode do not activate scripts, transform them to nowiki blocks
			return that.place_holder_dnl(snippets, that._make_preformatted(
				woas.i18n.JS_DISABLED + str, 'border:1px solid #f00'), dynamic_nl);
		} // else
		var m = $1.match(/src=(?:"|')([^\s'">]+)/),
			external = (m!==null);
		woas.scripting.add(script_target, external ? m[1] : $2, external);
		return "";
	});

	// take away style blocks
	P.body = P.body.replace(this.reStyles, function(str, $1, dynamic_nl) {
		return that.place_holder_dnl(snippets, str, dynamic_nl);
	});

	// put a placeholder for the TOC (including dynamic newline)
	this.has_toc = false;
	P.body = P.body.replace(this.reTOC, function(str, dnl) {
		that.has_toc = true;
		if (typeof dnl === "undefined") dnl = ""; // IE
		else if (dnl !== "") dnl = that.NL_MARKER + dnl;
		return that.marker + "TOC" + dnl;
	});

	// wiki tags
	this.inline_tags = 0;

	// static syntax parsing
	this.syntax_parse(P, snippets, tags, this.has_toc);

	// restore macros to those already defined before page was parsed
	woas.macro.remove_backup();

	// sort tags at bottom of page if set in config
	tags = tags.toUnique();
	if (woas.config.sort_tags) { tags = tags.sort(); }
	if (tags.length && !this.export_links) {
		var s;
		if (this.force_inline)
			s = "";
		else
			s = "<"+"div class=\"woas_taglinks\">";
		s += "Tags:";
		for(var i=0;i < tags.length;++i) {
			s += " <"+"a onclick=\"woas.go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+
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

	// syntax parsing has finished; apply any final changes
	if (this.after_parse === backup_hook)
		this.after_parse(P);

	// finished
	return P.body;
},

// XHTML lists and tables parsing code by plumloco
// There is no limit to the level of nesting and produces valid XHTML markup
// Refactored by PVHL to avoid some string copying and incorporate sublist
// (can be improved further by pushing strings to array and joining at end)
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

	var lst_item = '<'+'li>%s<'+'/li>' + woas.parser.NL_MARKER + '\n',
		lst_type = [
			'<'+'ul>%s<'+'/ul>' + woas.parser.NL_MARKER,
			'<'+'ol>%s<'+'/ol>' + woas.parser.NL_MARKER,
			'<'+'ol type="a">%s<'+'/ol>' + woas.parser.NL_MARKER
		],
		stk = []; // collect all items in a stack
	type = "*#@".indexOf(type);
	if (type === -1) return; // shouldn't be possible
	str.replace(woas.parser.reListItem, function(str, p1, p2) {
		stk.push([str, p1, p2]);
	});
	return lst_type[type].sprintf(sublist(stk, 1, type));
},

// put away stuff contained in user-defined macro blocks
// PVHL: needs more refactoring; pass snippets to macro? Returned
//   text should not need more processing
//   m.block flags removal of dnl; being tested as a possible remedy
//   for some formatting issues (works well, but undocumented at present;
//   there is probably a better way to do this though).
parse_macros: function(P, snippets) {
	var that = this;
	P.body = P.body.replace(this.reMacros, function (str, $1, dynamic_nl) {
		dynamic_nl = dynamic_nl || '';
		// ask macro_parser to prepare this block
		var macro = woas.macro.parser($1);
		if (macro.reprocess) {
			// allow further parser processing
			return macro.text + (macro.block ? that.NL_MARKER : '') +
				dynamic_nl;
		}
		if (!macro.defn && snippets.length) {
			// text could have nowiki text in it so retrieve now
			// (don't want snippet references stored in snippets).
			// can't use undry because of name difference; FIX?
			macro.text = macro.text.replace(that.reBaseSnippet,
				function (str, $1) {
					return snippets[parseInt($1)];
				})
		}
		if (macro.block) {
			// definitions and block macros
			return that.place_holder_dnl(snippets, macro.text, dynamic_nl)
		}
		return that.place_holder(snippets, macro.text) + dynamic_nl;
	});
},

// 'inline' has no breaks at all between the markers.
// 'multiline' has first and last \n removed
parse_nowiki: function(P, snippets) {
	var that = this;
	P.body = P.body.replace(this.reNowiki, function (str, n1, nw, n2, dynamic_nl) {
		if (n1 || n2 || nw.indexOf("\n") !== -1) {
			nw = woas.parser._raw_preformatted("pre", nw, "woas_nowiki_multiline");
			return that.place_holder_dnl(snippets, nw, dynamic_nl);
		} else {
			nw = woas.parser._raw_preformatted("tt", nw, "woas_nowiki");
			return that.place_holder(snippets, nw) + (!dynamic_nl ? '' : dynamic_nl);
		}
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
				return (caption = caption || ('<'+'caption' + (stk.length > 0 ? ' style="caption-side:bottom">' : '>') + pp2 + '<'+'/caption>'));
			case '*':
				return (colgroup = pp2);
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

/* PVHL:
 * Removed separator as unneeded.
 * Rewrote to perform entire place_holder function here. Will be slightly slower
   but only optimize if truly needed. Rest of code is much simpler this way.
 * Existence of dnl needs to be checked for IE so parameter is technically optional.
 * Split function into place_holder_dnl and place_holder for simplicity/readability
 * place_holder_dnl marks a following newline for later removal if it exists
*/
place_holder: function (snippets, str) {
	snippets.push(str);
	return this.marker + (snippets.length - 1) + ';';
},

place_holder_dnl: function (snippets, str, dnl) {
	snippets.push(str);
	return this.marker + (snippets.length - 1) + ';' +
		(!dnl ? '' : this.NL_MARKER + dnl);
},

// NOTE: XHTML comments can now be contained in nowiki and macro blocks
//  no_macros used by macro.parse; optional
pre_parse: function(P, snippets, no_macros) {
	var that = this;
	// put away stuff contained in nowiki blocks {{{ }}}, macros, and XHTML-style comments
	this.parse_nowiki(P, snippets);
	if (!no_macros) { this.parse_macros(P, snippets); }
	P.body = P.body.replace(this.reComments, function (str, comment, dynamic_nl) {
		// don't skip anything -- remove all comments for future syntax needs
		return that.place_holder_dnl(snippets, str, dynamic_nl);
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
syntax_parse: function(P, snippets, tags, has_toc) {
	var that = this;

	// restore text lines (lines ending in '\' are joined)
	P.body = P.body.replace(/\\\n/g, "")

	// put HTML tags and tag sequences away (along with attributes)
	.replace(this.reHtml, function(str, ws, tags, last, dnl) {
		// stop certain html block tags from having a br tag appended when at line end
		if (that.reBlkHtml.test(last))
			return ws + that.place_holder_dnl(snippets, tags, dnl);
		return ws + that.place_holder(snippets, tags) + (!dnl ? '' : dnl);
	})

	// render links e.g. [[target]] & [[target|label]]
	.replace(this.reWikiLink, function(str, target, label) {
		if (target)
			return that._render_wiki_link(target, label, snippets, tags);
		return str; // not a valid link
	})

	// remove URL style text ('*://*') to avoid parsing problems.
	.replace(this.reAutoLinks, function(str, prot) {
		// only return a link if autolinks on and a target exists
		return that.place_holder(snippets,
			woas.config.auto_links && prot && (prot.length + 3 !== str.length)
			? '<'+'a class="woas_world_link" href="'+str+
				'" target="_blank">'+str+'<'+'/a>'
			: str);
	})

	// italics/underline/bold all operate on a single line now; otherwise
	// they act as they did in 0.12.0 unless otherwise noted.

	// italics (needs to be done before code that adds html; this should be fixed
	// by changing how block level syntax is parsed). Italics can't start after a
	// colon, presumably to stop 'c:/my/path' from disappearing. Will fix in new.
	.replace(/(^|_|[^\w:])\/(.+?)\//mg, "$1<"+"em>$2<"+"/em>")

	// underline (now works on a single line the same as bold/italics)
	.replace(/(^|[^\w])_(.+?)_/mg, "$1<"+
		"span style=\"text-decoration:underline;\">$2<"+"/span>")

	// ordered/unordered lists parsing (code by plumloco)
	.replace(this.reListReap, this.parse_lists)

	// tables-parsing pass (parse_tables & reReapTables are in legacy.js)
	.replace(woas.config.new_tables_syntax ? this.reReapTablesNew : this.reReapTables,
				woas.config.new_tables_syntax ? this.parse_tables_new : this.parse_tables
	)

	// bold (needs to be after lists & tables). 0.12.0 doesn't allow start
	// after / or \; this code does as can't see need, esp. with URLs protected
	.replace(/(^|[^\w])\*(.+?)\*/mg, "$1<"+"strong>$2<"+"/strong>")

	// horizontal rulers: multiline RE used; adding NL_MARKER will remove the \n following.
	.replace(this.reRuler, this._HR + this.NL_MARKER);

	// other custom syntax should go into this callback
	this.extend_syntax(P);

	// headings - only h1~h6 are parsed;
	P.body = P.body.replace(this.reHeading, function(str, depth, heading) {
		//that.heading_replace(depth, heading, snippets);
		if (!heading) { return str; } // needed?
		var anchor, toc_entry, len = depth.length;
		// remove any markers and html
		toc_entry = heading.replace(that.reBaseSnippet, function (str, $1) {
				return snippets[parseInt($1)];
			})
			.replace(/(<\/?\w+[^>]*>)+/g, '');
		anchor = that.heading_anchor(toc_entry);
		if (that.has_toc) { // [level, anchor, straight heading text, ...]
			that.toc.push(len);
			that.toc.push(anchor);
			that.toc.push(toc_entry);
		}
		return "<"+"h"+len+" class=\"woas_heading\" id=\"" + anchor +
			"\">" + heading + "<"+"/h"+len+">" + woas.parser.NL_MARKER;
	});

	// replace [[Special::TOC]]
	if (has_toc) {
		P.body = P.body.replace(this.marker+"TOC", function() {
			return that.toc_render();
		});
	}

	// clear dynamic newlines
	P.body = P.body.replace(this.reNL_MARKER, "")

	// cleanup \n after certain block tags (set by reNewlineAfter)
	.replace(this.reNewlineAfter, "$1")

	// cleanup \n before certain block tags (set by reNewlineBefore)
	.replace(this.reNewlineBefore, "$1")

	// convert newlines to br tags
	.replace(/\n/g, "<"+"br />");

	// put back snippets removed by place_holder
	this.undry(P, snippets);
	snippets = null;
},

// override to generate a different style of TOC
toc_body: '<'+'div id="woas_toc"><' +
	'div id="woas_toc_title"><'+'a onclick="d$.toggle(\'woas_toc_content\')"' +
	'>%s<'+'/a><'+'/div><'+'div id="woas_toc_content">%s<'+'/div><'+'/div>',
toc_body_exp: '<'+'div id="woas_toc"><'+'div id="woas_toc_title">%s<' +
	'/div><'+'div id="woas_toc_content">%s<'+'/div><'+'/div>',
toc_line: '<'+'div class="woas_toc_h%s"><' +
	'a class="woas_link" onclick="woas.go_to(\'#%s\')">%s<'+'/a><'+'/div>',
toc_line_exp: '<'+'div class="woas_toc_h%s"><' +
	'a class="woas_link" href="#%s">%s<'+'/a><'+'/div>',
// to allow overriding of TOC line rendering
toc_line_render: function(level, count, anchor, heading) {
	// the count array could be used for section numbering; e.g. 1.1.2
	// for current count just use count[level]
	return this.toc_line.sprintf(level, anchor, heading);
},
// PVHL: added in case user wants different TOC generated for exported pages
toc_line_render_exp: function(level, count, anchor, heading) {
	// see notes for toc_line_render
	return this.toc_line_exp.sprintf(level, anchor, heading);
},
// replace the TOC placeholder with the real TOC
// This function should not need to be overwritten; toc_line_render, toc_line,
// & toc_body (and related export versions) should be sufficient to generate
// any desired TOC.
toc_render: function() {
	// this.toc: [level, anchor, heading text, level, anchor, ...]
	var i, il, j, tmp = [], count = [], level,
		body = this.export_links ? this.toc_body_exp: this.toc_body,
		line_fn = this.export_links ? this.toc_line_render_exp : this.toc_line_render;
	for (i = 0, il = this.toc.length; i < il;) {
		level = this.toc[i++];
		count[level] = count[level] ? count[level] + 1 : 1;
		for (j = level + 1; j < 7; ++j) {
			count[j] = 0;
		}
		// toc_line_render(level, count, anchor, heading)
		tmp.push(line_fn.call(this, level, count, this.toc[i++], this.toc[i++]));
	}
	this.toc = [];
	return body.sprintf(woas.i18n.TOC, tmp.join(''));
},

//API1.0
//TODO: offer transclusion parameters argument
transclude: function(title, snippets, img_gallery) {
	this._snippets = snippets;
	var rv = this._transclude("[[Include::"+title+"]]", title, img_gallery);
	this._snippets = null;
	return rv;
},

transclude_syntax: function(P, snippets) {
	var trans_level = 0, that = this, found;
	this._snippets = snippets;
	do {
		found = false;
		P.body = P.body.replace(this.reTransclusion, function(str, $1) {
			found = true;
			return that._transclude(str, $1);
		});
		// keep transcluding when a transclusion was made and when transcluding depth is not excessive
	} while (found && ++trans_level < this._MAX_TRANSCLUSION_RECURSE);
	if (trans_level === this._MAX_TRANSCLUSION_RECURSE) { // parse remaining inclusions as normal text
		P.body = P.body.replace(this.reTransclusion, function (str, $1) {
			return that.place_holder(snippets, that.render_error(str, 'infin'));
		});
	}
	this._snippets = null;
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
