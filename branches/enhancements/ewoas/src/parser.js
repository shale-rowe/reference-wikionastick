// module @parser
woas.parser = {
	render_title: null,			// title of page being rendered
	has_toc: null,
	toc: "",
	force_inline: false,		// used not to break layout when presenting search results
	inline_tags: 0,
	_parsing_menu: false,		// true when we are parsing the menu page
	// properties used by _transclude
	_snippets: null,
	_export_links: null,

	header_anchor: function(s) {
		// apply a hard normalization
		// WARNING: will not preserve header ids uniqueness
		return s.replace(this.reNormHeader, '_')
	},
	
	// @override to apply some further customization before parse output
	after_parse: function(P) {
	},
	
	// @override to parse further syntax before final replace
	extend_syntax: function(P) {
//		//Example: note ! or !{class}
//		P.body = P.body.replace(/^!(?:\{(\w+)\})?\s*(.+)$/gm, function (str, $1,$2) {
//			return "<div class=\"" + ($1?$1:"note") + "\">"+$2+"</div>";
//		})
	},

	render_error: function(str, symbol) {
		//	if (typeof symbol == "undefined")
		//		symbol = "infin";
		symbol = "&"+symbol+";";
		return "<"+"span style=\"color:red;font-weight:bold;\">"+symbol+" "+str+" "+symbol+"<"+"/span>";
	},
	
	// a variety of regular expressions used by the parser
	reBoldSyntax: /([^\w\/\\])\*([^\*\n]+)\*/g,
	//DEPRECATED "!" syntax for header, now used as note.
	reHeaders: /^(={1,6})(?:\{([ \w]+)\})?\s*(.*?)(?:[ \t]*\1([^\n]*))?$/gm, 
	reNormHeader: /[^a-zA-Z0-9]/g,
	sTOC: "[[Special::TOC]]",
	reHasDNL: new RegExp("^([ \\t]*\\n)"),
	_MAX_TRANSCLUSION_RECURSE: 16,

	marker: null,
	reBaseSnippet: null,
	NL_MARKER: null,
	reNL_MARKER: null,
	_init: function() {
		this.marker = "#"+_random_string(8); // TODO: NO RANDOM STRING!
		this.reBaseSnippet = new RegExp("<\\!-- "+this.marker+"::(\\d+) -->", "g");
		this.NL_MARKER = "<!-- "+this.marker+"_NL -->";
		this.reNL_MARKER = new RegExp("<\\!-- "+this.marker+"_NL -->([ \\t]*\\n)?", "g");
	}
};

// initialize here because IE would fail otherwise
woas.parser._init();

woas.parser.header_replace = function(str, $1, $class, header, xtra) {
		var len = $1.length;
		that = woas.parser;
		// automatically build the TOC if needed
		if (that.has_toc)
			that.toc += String("#").repeat(len)+" <"+'a class="woas_link" href="javascript:woas.scrollTo(\''
			+that.header_anchor(header)+'\')'+"\">" + header + "<\/a>\n";
		return "<"+"h"+len+' class="'+($class||"woas_header")+'" id="'+that.header_anchor(header)+'">'+header+"<"+"/h"+len+">"+xtra;
};


// XHTML lists and tables parsing code by plumloco, and then enhanced by FBnil.
// There is no limit to the level of nesting and produces valid XHTML markup
// @{disc;list-style-image:url (/images/icons/bullet.gif);} hii
// @{bullet.png}   @{$BULLET}  
// @{square} Square List Item
var reReapLists = /\n?^(?:\*|#|@).*(?:\n\*.*|\n#.*|\n@.*)*/gm,
	reItems = /^((?:\*|#|@(?:[iIaA1#\*]|{[^}]*})?)+)[ \t](.*)$/im,
	reItem = /^(?:\*|#|@)/im;
woas.parser.parse_lists = function(s) {
	var A=s.replace(/\\\\\n/, "<br/>").split(/\n/);
	var firstline = A.shift();
	if(!firstline && A.length>0) firstline = A.shift();
	var fl= "";
	var close="";
	if(!firstline.match(reItems))return s;
	firstline=firstline.replace(reItems,
			function(str,a,b,c){
					fl=a;
					var open="";
					if(a == '*'||a=='@*'){
						open='<ul style="list-style-image:none">'; close="</ul>"
					}else{
						open='<ol style="list-style-image:none">'; close="</ol>"
						var w = a.split("");
						if(w[1] || a=='@'){
							if(w[1]=='{'){
								a = woas.title_unalias(a.replace(/@{(.*)}/,"$1"));
								if(a.match("="))
									open= '<ol '+ a +'>'
								else if(a.match(":"))
									open= '<ol style="'+ a +';">'
								else if(a.match(/\./))
									open= '<ol class="woas_img" style="list-style-image:url('+ escape(a) +');">'
								else if(a)
									open= '<ol style="' +(a == "inherit"? '':'list-style-image:none;')+'list-style-type:'+ a +';">'
								else
									open=close="";
							}else
								open='<ol style="list-style-image:none" TYPE="'+(w[1]?w[1]:(a=="@"?'a':a))+'">'; // TODO: TYPE is Deprecated must be replaced
						}else{
						 // # no values needed.
						}
					}
					return open+"<li>"+b;
	});
	
	// Search for brothers and children
	while(A.length>0){
		var CHILD= "";
		var R = new RegExp("^"+RegExp.escape(fl));
		if(A[0] == ""){
			A.shift();
		}else{
			while (A.length>0 && A[0].replace(R,"").match(reItems)) {
				CHILD += A.shift().replace(R,"")+"\n";
			}
			if(CHILD)
				firstline += woas.parser["parse_lists"](CHILD);
			else 
				firstline += "<li>" + A.shift().replace(R,"").replace(/^[ \t]+/,"");
		}
	}
	return firstline+close;
};

// new table parsing by FBNil
var reReapTablesNew = /^\{\|(.*)((?:\n\|.*)*)$/gm,
	reReapTablesNewSub1 = /\n\|([+ \t-\|])(.*)/g,
	reReapTablesNewSub2 = /(\|\|)(\s{0,1})(\s?)(?=\|\|)/g,
	reReapTablesNewSub3 = /(\|\|\s*)$/,
	reReapTablesNewSub4 = /\|\|\t/g,
	reReapTablesNewSub5 = /\t\|\|/g,
	reReapTablesHead = /^(\s*)(?:(=+)\s*)?(.*?)(\s*)$/m;
woas.parser.parse_tables_new = function (str, prop, p1) {
    var caption = '',
		colgroup = '',
		stk = [],
		cols = [],
		CC = [];
	// variables used by replace callback
	var i, C, CL;
    p1.replace(reReapTablesNewSub1, function (str, pp1, pp2) {
		switch (pp1) {
			case '-': // comment
				return;
			case '+': //caption
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

        var cells = pp2.replace(reReapTablesNewSub2, "$1$2$3  ").
				replace(reReapTablesNewSub3, "$1 ").
				replace(reReapTablesNewSub4, "|| ").
				replace(reReapTablesNewSub5, " ||").split(" || "),
			row = [],
			stag = "",
			cs = 0;
        for (i = cells.length - 1; i >= 0; --i) {
            C = cells[i].match(reReapTablesHead);
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
    return '<'+'table ' + ((prop.indexOf("class=")!==-1) ? '' : 'class="woas_text_area" ') + prop + '>' + caption + colgroup + '<'+'tr>' + stk.join('<'+'/tr><'+'tr>') + '<'+'/tr>' + '<'+'/table>'
};

// extract the wiki tags from a wiki URL
woas._get_tags = function(text, last_tag) {
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
	if (last_tag !== null) alltags = alltags.concat(this.split_tags(last_tag));
	for(var i=0;i < alltags.length;i++) {
		tag = this.trim(alltags[i]);
		if (tags.indexOf(tag)===-1)
			tags.push(tag);
	}
	return tags;
};

// split one or more tags
//NOTE: no trim applied
woas.split_tags = function(tlist) {
	if (tlist.indexOf(",")!==-1)
		return tlist.split(","); //DEPRECATED but still supported
	return tlist.split("|");
};

// elements which can have one dynamic newline
var reScripts = new RegExp("<"+"script([^>]*)>([\\s\\S]*?)<"+"\\/script>([ \t]*\n)?", "gi"),
	reStyles = new RegExp("<"+"style([^>]*)>[\\s\\S]*?<"+"\\/style>([ \t]*\n)?", "gi"),
	reRuler = /^[ \t]*\-{4,}[ \t]*$/gm,
	reNowiki = /\{\{\{(\n?)([\s\S]*?)\1\}\}\}([ \t]*\n)?/g,
	//TODO: FBnil: Quick hack to allow Aliases in transclusions, needs to be tested though
	reTransclusion = /\[\[(Include::|\$)([\s\S]+?)\]\]([ \t]*\n)?/g,
	reMacros = /<<<([\s\S]*?)>>>([ \t]*\n)?/g,
	reComments = /<\!--([\s\S]*?)-->([ \t]*\n)?/g,
// the others have not
	reWikiLink = /\[\[(.*?)(?:\|(.*?))?\]\]/g,
	reMailto = /^mailto:\/\//,
	reCleanupNewlines = new RegExp('\n?((<\\/h[1-6]>)|(<\\/[uo]l>))(\n+)', 'g');

	// PVHL commented out the following section: TODO: Remove this as well.
woas.parser.place_holder = function (i, separator, dynamic_nl) {
	if (typeof separator == "undefined")
		separator = "";
	if (typeof dynamic_nl == "undefined")
		dynamic_nl = "";
	else if (dynamic_nl !== "") // put newlines after blocks which have an ending newline
		dynamic_nl = this.NL_MARKER+dynamic_nl;
	separator = ":"+separator+":";
	return "<!-- "+woas.parser.marker+separator+i+" -->"+dynamic_nl;
};

// create a preformatted block ready to be displayed
woas._make_preformatted = function(text, add_style,isBlock) {
	var cls = "woas_nowiki", tag,p=text.indexOf("\u21B5");
//	alert("TEXT("+text+")")
	if (text.indexOf("\n") == -1 && p != 0) {
		tag = "tt";
	} else {
		if (p === 0) text = text.substr(1);
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

// This method can be overriden to customize parsing
// Other useful callbacks to control flow of page display: woas.after_parse and woas.pager.browse

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
			woas.crash("Called parse() with invalid argument: "+(typeof text));	// log:1
			return null;
		}
	}
	// default fallback
	if (typeof export_links == "undefined")
		export_links = false;
	if (typeof js_mode == "undefined")
		js_mode = 1;
	
	// put text in an object
	var P = { body: text }; text = null;
	// snippets array will contain all the HTML snippets that will not be parsed by the wiki engine
	var snippets = [], r, backup_hook = this.after_parse;
	
	// comments and nowiki blocks
	this.pre_parse(P, snippets);

	// macros
	this.parse_macros(P, snippets);

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
		P.body = P.body.replace(reScripts, function (str, $1, $2, dynamic_nl) {
			if (js_mode==2) {
				r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
				snippets.push(str);
				return r;
			} else if (js_mode==3) {
				// during safe mode do not activate scripts, transform them to nowiki blocks
				r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
				snippets.push( woas._make_preformatted(str) );
				return r;
			} // else
			var m=$1.match(/src=(?:"|')([^\s'">]+)/),
				external = (m!==null);
			woas.scripting.add(script_target, external ? m[1] : $2, external);
			return "";
		});
	}
	
	// take away style blocks
	P.body = P.body.replace(reStyles, function(str, $1, dynamic_nl) {
		r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
		snippets.push(str);
		return r;
	});
	
	// put a placeholder for the TOC
	var p = P.body.indexOf(this.sTOC);
	if (p !== -1) {
		this.has_toc = true;
		P.body = P.body.substring(0, p) + "<!-- "+woas.parser.marker+":TOC -->" +
				// dynamic newlines also after TOC
				P.body.substring(p+this.sTOC.length).replace(this.reHasDNL, this.NL_MARKER+"$1");
	} //else this.has_toc = false;

	// wiki tags
	var tags = [];
	this.inline_tags = 0;
	
	this.syntax_parse(P, snippets, tags, export_links, this.has_toc);

	// sort tags at bottom of page, also when showing namespaces
	tags = tags.toUnique().sort();
	if (tags.length && !export_links) {
		var s = this.force_inline? "":"<"+"div class=\"woas_taglinks\">";
		s += "Tags: ";
		for(var i=0;i < tags.length;++i) {
			s += "<"+"a class=\"woas_link\" onclick=\"woas.go_to('Tagged::"+woas.js_encode(tags[i])+"')\">"+
				woas.xhtml_encode(tags[i])+"<"+"/a>&nbsp;&nbsp;";
		}
		if (!this.force_inline) {
			s+="<"+"/div>";
			P.body += s;
		} else { // re-print the inline tags (works only on last tag definition?)
			P.body = P.body.replace(new RegExp("<\\!-- "+woas.parser.marker+":(\\d+) -->", "g"), function (str, $1) {
				// loose comparison is OK here
				if ($1 == woas.parser.inline_tags)
					return s;
				return "";
			});
		}
	}
	// reset the flaggers
	if (this.force_inline)
		this.force_inline = false;
	if (woas.macro.has_backup())
		// restore macros array
		woas.macro.pop_backup();

	// syntax parsing has finished, do you want to apply some final cosmethic?
	if (this.after_parse === backup_hook)
		this.after_parse(P);
	
	// finished
	return P.body;
};

woas.parser.parse_macros = function(P, snippets) {
	// put away stuff contained in user-defined macro multi-line blocks
	P.body = P.body.replace(reMacros, function (str, $1, dynamic_nl) {
		if (!woas.macro.has_backup())
			// take a backup copy of the macros, so that no new macros are defined after page processing
			woas.macro.push_backup();

		// ask macro_parser to prepare this block
		var macro = woas.macro.parser($1);
		// allow further parser processing
		if (macro.reprocess) {
			if (typeof dynamic_nl != "undefined" && dynamic_nl!=="")
				macro.text += woas.parser.NL_MARKER+dynamic_nl;
			return macro.text;
		}
		r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
		// otherwise store it for later
		snippets.push(macro.text);
		return r;
	});
};

//NOTE: XHTML comments cannot be contained in nowiki or macro blocks
woas.parser.pre_parse = function(P, snippets) {
	// put away stuff contained in inline nowiki blocks {{{ }}}     // \u21B5 is &crarr;
	P.body = P.body.replace(reNowiki, function (str, isBlock,$1,dynamic_nl) {
		snippets.push(woas._make_preformatted((dynamic_nl? "\u21B5":"")+$1,"",isBlock));
		return woas.parser.place_holder(snippets.length-1, "", dynamic_nl);
	})
	// put away XHTML-style comments
	.replace(reComments, function (str, comment, dynamic_nl) {
		// skip whitespace comments and snippets
		if (comment.match(/^\s+$|^\s#/))
			return str;
		snippets.push(str);
		return woas.parser.place_holder(snippets.length-1, "", dynamic_nl);
	})
	// Escape wiki with tilde. TODO: Escape http urls (now we http:~//escaped.com, but should be ~http://escaped.com)
	.replace(/~([^\nA-Za-z0-9])/g, function (str, $1) {
		snippets.push(woas.xhtml_encode($1));
		return woas.parser.place_holder(snippets.length-1, "", "");
	})
	// allow non-wrapping newlines
	.replace(/\\\\\n/g, "<br/>").replace(/\\\n/g, "")
	// Images {{image.jpg?16x16:middle|alternative text|class}} or {{ image.jpg|alternative text|vertical-align: middle}}
	.replace(/\{\{(\s*)([^\{\}]*?)(\s*)(?:\|(.*?))?(?:\|(.*?))?\}\}/g, function (str, $l, $1, $r, $2, $3){
		if($1.indexOf(":")==-1 || $1.substr(0, 1) === "$")
			$1=woas.title_unalias($1); 
		if(!$1) $1= woas.eval($2,1);
		$3= $3||""; // required for IE8
		var t= $3? ($3.match("=")?$3:($3.match(":")?'class="woas_img" style="'+$3+'"':'class="'+$3+'"')) :'class="woas_img"';
		if($l+$r)
			t = t.replace(/class="/, 'class="'+['w_left', 'w_right', 'w_center'][$l?$r?2:1:0]+' ');
		$1 = $1.replace(/\?(\d*?)(?:x(\d+))?(?:\:(.+))?$/,
			function(mstr, w,h,v){t+= (w?' width="'+w+'"':'')+(h?' height="'+h+'"':'')+(v?' style="vertical-align:'+v+'"':'');return "";});
		if($1.match(/^=/)){
			if($1.indexOf(".")!=-1 && $1.indexOf("Image::")==-1)
				$1="=Image::"+$1.substr(1);
			if($1.indexOf("::")!=-1)
				return '[[Include::'+$1.substr(1)+'|'+t+($2? ' alt="'+$2+'"':'')+']]'; //transclude embedded image
			if($1.indexOf(":")!=-1)
				$1 = $1.substr(1); // data:image
			else if(d$($1.substr(1)))
				$1 = d$($1.substr(1)).src; // button images
		}
		snippets.push("<img "+t+" src=\""+$1+ '"' + ($2? ' alt="'+$2+'"':'')+'>');
		return woas.parser.place_holder(snippets.length-1);
	})
};

//API1.0
//TODO: offer transclusion parameters argument nilton:?this already there!?
woas.parser.transclude = function(title, snippets, export_links) {
	this._snippets = snippets;
	this._export_links = export_links ? true : false;
	var rv = this._transclude("[[Include::"+title+"]]", title);
	this._export_links = this._snippets = null;
	return rv;
};

woas.parser._snippets = null;
woas.parser._transcluding = 0;
woas.parser._transclude = function (str, $2, $1, dynamic_nl) {
	if($2 == "$") {
		$1=$2+$1;
		var v = $1.split("|",2);
		$1=woas.title_unalias(v[0]) + (v[1]?"|"+v[1]:"");
		if($1.indexOf("Include::")==-1) return "[["+$1+"]]"+dynamic_nl;
		$1=$1.substring(9);
	}else if(!$1) $1=$2
	var that = woas.parser,
		parts = $1.split("|"),
		templname = parts[0],
		is_emb = false, ns=woas.get_namespace(templname, true),
		// temporary page object
		P = { body: null };
	// increase transclusion depth
	++that._transcluding;
//	woas.log("Transcluding "+templname+"("+parts.slice(0).toString()+")");	// log:0
	// in case of embedded file, add the inline file or add the image
	if (woas.is_reserved(templname) || (templname.substring(templname.length-2)=="::"))
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
		var templs="[["+templname+"]]";
		if (parts.length>1)
			templs += "|"+parts.slice(1).join("|");
		r = woas.parser.place_holder(that._snippets.length, "", dynamic_nl);
		// show an error with empty set symbol
		that._snippets.push(woas.parser.render_error(str, "#8709"));
		--that._transcluding;
		return r;
	}
	if (is_emb) {
		r = woas.parser.place_holder(that._snippets.length, "", dynamic_nl);
//		woas.log("Embedded file transclusion: "+templname);	// log:0
		if (woas.is_image(templname)) {
			var img, img_name = woas.xhtml_encode(templname.substr(templname.indexOf("::")+2));
			if (woas.parser._export_links) {
				// check that the URI is valid
				var uri=woas.exporter._get_fname(templname);
				if (uri == '#')
					img = woas.parser.render_error(templname, "#8709");
				else
					img = "<"+"img src=\""+uri+"\" alt=\""+img_name+"\" ";
			} else
				img = "<"+"img src=\""+P.body+"\" ";
			if (parts.length>1) {
				img += parts[1];
				// always add the alt attribute to images
				if (!woas.parser._export_links && !parts[1].match(/alt=('|").*?\1/))
					img += " alt=\""+img_name+"\"";
				if(!parts[1].match(/class=('|").*?\1/))
					img += ' class="woas_embedded"' ;
			}
			that._snippets.push(img+" />");
		} else { // embedded file but not image
			if ((parts.length>1) && (parts[1]=="raw"))
				that._snippets.push(woas.base64.decode(P.body));
			else
				that._snippets.push("<"+"pre class=\"woas_embedded\">"+
						woas.xhtml_encode(woas.base64.decode(P.body))+"<"+"/pre>");
		}
		P.body = r;
	}
	
	if (!is_emb) {
		// take away XHTML comments and nowiki blocks
		that.pre_parse(P, that._snippets);

		// finally replace transclusion parameters
		if (parts.length) {
			P.body = P.body.replace(/%\d+/g, function(str) {
				if(str == "%0")
					return woas.parser.render_title; // %0 is the pagename that called the transclusion (for the template name use %00)
				var paramno = parseInt(str.substr(1));
				if (paramno < parts.length){
					// if we did %01 instead of %1 we want to parse a multiline parameter with \n replaced as <br>.
					if ("%0"+paramno == str)
						return parts[paramno].replace(/\n/g, "<br>");
					return parts[paramno];
				}else
					return str;
			} );
		}
		that.parse_macros(P, that._snippets);
	} // not embedded
	--that._transcluding;
	//add the previous dynamic newline
	if (typeof dynamic_nl != "undefined" && dynamic_nl!=="")
		P.body += that.NL_MARKER+dynamic_nl;
	return P.body;
};

woas.parser.transclude_syntax = function(P, snippets, export_links) {
	var trans_level = 0;
	this._snippets = snippets;
	this._export_links = export_links ? true : false;
	do {
		P.body = P.body.replace(reTransclusion, this._transclude);
		// keep transcluding when a transclusion was made and when transcluding depth is not excessive
	} while (++trans_level < this._MAX_TRANSCLUSION_RECURSE);
	this._snippets = null;
	if (trans_level === this._MAX_TRANSCLUSION_RECURSE) { // parse remaining inclusions as normal text
		P.body = P.body.replace(reTransclusion, function (str, $1, dynamic_nl) {
			r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
			snippets.push(woas.parser.render_error(str, "infin"));
			return r;
		});
	}
	this._snippets = this._export_links = null;
};

// parse passive syntax only
woas.parser.syntax_parse = function(P, snippets, tags, export_links, has_toc) {
	// strikethrough
	P.body = P.body.replace(/(^|[^\w\/\\\<\>!\-])\-\-([^ >\-].*?[^ !])\-\-/mg, "$1<strike class=\"woas_strike\">$2</strike>")

	//definition list
	.replace(/^;(.*(?:\n[^\n].*)+)\n?/gm, function (str,$1) {
		var D=$1.split(/;/), l,A,dt;
		function entag(tag,text,pv){return '<'+tag+(pv?' '+pv:'')+'>'+text+'</'+tag+'>';}
		var M="";
		while(D.length){
			A=D.shift().replace(/^([^\n]+):/, "$1\n:").split(/\n:/);
			M+=entag('dt',A.shift());
			while(A.length)
				M+=entag('dd',A.shift());
		}
		return entag('dl',M,'class="w_dl"')
	})
	
	// Indent :  <div style="margin-left:2em"> or http://meyerweb.com/eric/css/tests/css2/sec08-03c.htm
	.replace(/(^|\n|<br\/>)(:+)\s*([^\n]+)/mg, function (str, $1,$2,$3) {
		return $1+'<span style="margin-left:'+($2.length)+'em">'+$3+'</span>';
	})
	
	// Footnotes((this is a footnote)) and(({symbol}This is another footnote with symbol instead of numbering)) 
	// also: +4((add this text to footnote 4)) and +(())  -(())  (feature creeped footnote)
	.replace(/\(\((?:\{([^\{\}]+)\})?(.*?)\)\)/g,  function (str, xu, txt) {
			// Reset footnotes
		if(typeof(woas["fn_counter"])!='number'){
			woas["fn"] = []; woas["fnu"] = [];  woas["fnuH"]= {}; woas["fn_counter"]=0; woas["fnN"]={};
		}
		woas["fn_N"] = woas["fn_N"] || 0;
		function addfr(n,x){return '<em><sup><a class="footref" name="'+woas["fn_N"]+'_notefoot'+n+'" onclick="window.setTimeout(woas.rescroll,0);return true;" href="#'+woas["fn_N"]+'_footnote'+n+'">'+x+'</a></sup></em>';}
	
		if(txt){ //We have a message, so we add a footnote reference
			P.footnote= P.footnote? ++P.footnote:1;
			
			// Check adding text (({+ID}TXT))
			if(xu.match(/^\+(\d+|\S+)$/)){
				xu.replace(/^\+(\d+|\S+)$/, function(str,d){
					if(d>0)
						woas["fn"][d-1]+=woas.parser.parse(txt);
					else if(woas["fnu"][d])
						woas["fnu"][d]+=woas.parser.parse(txt);
				});
				return "";
			}
			var xuu="";
			if(xu.match(/^@[IiAa]$/)){
				woas["fnN"][xu] = woas["fnN"][xu] || 0;
				var n = ++woas["fnN"][xu];
				xuu = xu + (10+n); // add 10 to solve sorting order (numerical versus ascii sort)
				function rome(N,s,b,a,o,t){t=N/1e3|0;N%=1e3;for(s=b='',a=5;N;b++,a^=7) for(o=N%a,N=N/a^0;o--;) s='IVXLCDM'.charAt(o>2?b+N-(N&=~1)+(o=1):b)+s; return Array(t+1).join('M')+s;}
				if(xu=="@I"){
					xu = rome(n);
				}else if(xu=="@i"){
					xu = rome(n).toLowerCase();
				}else if(xu=="@A"){
					xu = String.fromCharCode("A".charCodeAt(0)+n-1)
				}else if(xu=="@a"){
					xu = String.fromCharCode("a".charCodeAt(0)+n-1)
				}else{
					xu += n
				}
			}

			// Add to footnotes, if new
			var n;
			if(xu){
				if(!woas["fnuH"][xu]){
					woas["fnu"].push("{"+(xuu||(10+woas["fnu"].length))+":"+woas.parser.parse(xu)+"}"+woas.parser.parse(txt));
					woas["fnuH"][xu] = woas["fnu"].length;
				}
				n =woas["fnuH"][xu] + "u"+ (10+woas["fn_counter"]);
			}else{
				woas["fn"].push(woas.parser.parse(txt));
				n =woas["fn"].length + woas["fn_counter"];
			}
			
			// Add footref
			return addfr(n, (xu?xu:n));
			
		}else if(xu.match(/^[^+\-]$/)){ // No text, but has (({ID})), print as footref
			var n =xu>0?xu:woas["fnuH"][xu]? woas["fnuH"][xu]+ "u"+ woas["fn_counter"]: "ERROR UNDEFINED"+woas["fnuH"][xu];
			return addfr(n,xu);
		}else{ // either (({+})) or (({-})), print the footnotes
			// no footnotes defined, but we still want to print the header, to show that it is empty
			if(typeof(woas["fn_counter"])!='number')
				return('<br/><div class="wiki_footnote"><table class="wiki_footnote" border=0>'+'</table></div>');

			P.footnote=0;
//			alert(P.footnote+">>>>>"+woas["fnu"].join("|")+ ";"+woas["fn"].join("|"));
			var fn = "", fnu = "",f;
			function addfn(n,id,v){return '<tr><td VALIGN="top" class="wiki_footnote_n"><a class="woas_link" name="'+woas["fn_N"]+'_footnote'+n+'" onclick="window.setTimeout(woas.rescroll,0);return true;" href="#'+woas["fn_N"]+'_notefoot'+n+'">' +id+ '</a>)</td><td class="wiki_footnote_d">' + v  +"</td></tr>"}
			var i=1;
			woas["fnu"] = woas["fnu"].sort();
			while(f=woas["fnu"].shift()){
				var xu="";
				f=f.replace(/^\{([^\{\}]*):([^\{\}]+)\}/, function(s,u,x){xu=x;return "";})
				n = (i++) + "u" +(10+woas["fn_counter"]);
				fn += addfn(n,xu,f);
			};
			i=1;
			while(f=woas["fn"].shift()){
				n = (i++) +woas["fn_counter"] ;
				fn += addfn(n,n,f);
			};
			if(xu == "+")
				woas["fn_counter"]=woas["fn"].length;
			else
				woas["fn_counter"]= 0;
			woas["fn"] = [];
			woas["fn_N"] = (woas["fn_N"] || 0)+1;
			return(fn?'<br/><div class="wiki_footnote"><table class="wiki_footnote" border=0>' +fn+ '</table></div>' :'');
		}
	})

	// <sub> ,,subscript,, and <sup> ^^superscript^^
	.replace(/(,,|\^\^)(\S[^']*?)\1/g, function(str,$1,$2){
		var t = $1==',,'? "sub":"sup";
		return "<"+t+">"+$2+"<"+"/"+t+">";
	})

	// put away notes contained in multi-line "emphasized paragraph" blocks [[[ ]]] 
		.replace(/(?:!?\{([^\{\}]+)\})?\[{3}([\s\S]*?)\]{3}/g, function (str, cl,$1) {
			var multiline = $1.indexOf("\n")!=-1;
			var T= multiline?["div","note"]:["span","snote"];
			if(cl){
				cl=woas.title_unalias(cl).split("|");
				T[1]=cl[0];
			}
			return "<"+T[0]+(T[1]?' class="'+T[1]+'"':'')+(cl&&cl[1]?' style="'+cl[1]+'"':'')+(cl&&cl[2]?' id="'+cl[2]+'"':'')+'>'+$1+"</"+T[0]+">";
	})
	
	// put away ""quotes"" and ,,citations'' (polish quotes). Quotes are always inline, so no blockquote
		.replace(/(""|,,)([\s\S]*?)(""|'')/g, function (str, $1, $2) {
			var multiline = $2.indexOf("\n")!=-1;
			var T= $1=='""' ? (multiline?["q","quote"]:["q","quote"]) : (multiline?['blockquote', 'citation']:["q","citation"]);
			return "<"+T[0]+" class=\""+T[1]+"\">"+$2+"</"+T[0]+">";
	})
	
	// put away big enough HTML tags sequences (with attributes)
/*	.replace(/([ \t]*)((?:[ \t]*<\/?\w+.*?>)+)/g, function (str, ws, tags) {
		if (typeof ws === 'undefined') {
			ws = ''; // IE
		}
		r = ws + woas.parser.place_holder(snippets.length);
		snippets.push(tags);
		return r;
	}) */
	.replace(/(<\w+[^>]*>[ \t]*|[ \t]*<\/\w+[^>]*>)+/g, function (tag) {
		r = woas.parser.place_holder(snippets.length);
		snippets.push(tag);
		return r;
	})
//IMAGES WAS HERE, MOVED TO BEFORE TRANSCLUSION
	// links  [[Page|Title]] and [[Page]]
	.replace(reWikiLink, function(str, $1, $2, title) {
		return woas.parser._render_wiki_link($1, $2, snippets, tags, export_links, title);
	})

	// Acronyms (TODO: acronym vs abbr ?)  should not match list-style-image:url(mammoth.jpg)  [^\s\~]+
	.replace(/(^|\s)([\w\.\-\~]+)\(([^"'\(\)][^\)]{3,})\)/mg,  function(str,$1,$2,$3){
		snippets.push('<acronym class="woas_acronym" title="'+$3+'">'+$2+'</acronym>'); // +woas.parser.NL_MARKER+dynamic_nl
		return $1+woas.parser.place_holder(snippets.length-1);
	})

	// underline
	.replace(/(^|[^\w])_([^_]+)_/mg, "$1"+woas.parser.marker+"uS#$2"+woas.parser.marker+"uE#")
	// http url's (could be extended to other protocols than http(s), maybe ftp, or even gopher?
	.replace(/((?:https?|ftps?|news):\/\/\w+\S*[^,\. \n])/ig, function(str, $1) {
		return woas.parser._render_wiki_link($1, "", snippets, tags, export_links);
	})
	//CamelCase Links (TODO:add option to disable it) BUG: Random marker fubars
//	.replace(/(~?)\b([A-Z][a-z]+[A-Z]\w+)\b/g, function(str, nocamel,$1) {
//		if(nocamel)return $1;
//		return woas.parser._render_wiki_link($1, "", snippets, tags, export_links);
//	})
	// italics - code by Stanky
	.replace(/(^|[^\w:])\/([^\n \/][^\n\/]*)\/($|[^\w])/mg, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1)
			return str;
		return $1+"<em>"+$2+"</em>"+$3;
	})
	
	// Quoted ''monospace'' (multi-line)
	.replace(/''(\S[\s\S]*?)''/g, "<span class=\"woas_quoted\">$1</span>")
	// headers - only h1~h6 are parsed
	.replace(this.reHeaders, this.header_replace)
	// ordered/unordered lists parsing (code by plumloco)
	.replace(reReapLists, this.parse_lists)
	// note ! or !{class}
	.replace(/^!(?:\{([ \w\$]+)\})?\s*(.+)$\n?/gm, function (str, $1,$2) {
		if($1&&$1.substr(0,1)=="$")$1=woas.title_unalias($1);
		return "<div class=\"" + ($1?$1:"note") + "\">"+$2+"</div>"; // TODO: maybe rewrite as "<"+"div>$1<"+"/div>"? seems ok now?
	})
	// Indented blocks
	.replace(/(^|\n|<br\/>)  ([^\n]+)((?:\n  [^\n]+)*)\n?/mg, function (str, $1,$2,$3) {
		return $1+'<div class="indentedblock">'+$2+($3?$3:"")+'</div>';
	})

	
	// other custom syntax should go into this callback
	this.extend_syntax(P);
	
	// replace [[Special::TOC]]
	if (has_toc) {
		// replace the TOC placeholder with the real TOC should use .setHTMLDiv(d$('TOCTOGGLE'), data)
		P.body = P.body.replace("<!-- "+woas.parser.marker+":TOC -->",
				'<span><a id="TOCTOGGLE" class="woas_toc_toggle" href="Javascript:d$(\'TOCTOGGLE\').innerHTML= (woas.TOCDIV=!d$.is_visible(\'TOCDIV\'))?\'&#9660;\':\'&#9658;\';d$.toggle(\'TOCDIV\',1);">&#9658;</a></span>'+ 
			"<"+'div id="TOCDIV" class="woas_toc" ' + 
			(woas.TOCDIV ? 'style="display: block; visibility: visible;"' : 'style="display: none; visibility: hidden;"')
			+'><p class="woas_toc_title">Table of Contents<'+"/p>" +
				this.toc.replace(reReapLists, this.parse_lists)
				/*.replace("\n<", "<") */
				+ "<"+"/div>" );
		this.toc = "";
	}


	// add a dynamic newline at start to have consistent newlines for the ruler and other syntax regex
	P.body = this.NL_MARKER + "\n" + P.body;

	// use 'strong' tag for bold text
	P.body = P.body.replace(this.reBoldSyntax, "$1"+woas.parser.marker+"bS#$2"+woas.parser.marker+"bE#")

	.replace(new RegExp(woas.parser.marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
		if ($2=='E')
			return ($1=='u')? "<"+"/span>" : "<"+"/strong>";
		return ($1=='u')? "<"+"span style=\"text-decoration:underline;\">" : "<"+"strong>";
	})

	// 'hr' horizontal rulers made with 4 hyphens
	// only white spaces are allowed before/after the hyphens
	.replace(reRuler, function () {
		return "<"+"hr class=\"woas_ruler\" />" + woas.parser.NL_MARKER ;
/*
		var n = woas.trim(arguments[0].replace(/\s+/g, " ")).split(/\ /g).length,
			last_nl;
		if (arguments[arguments.length-3].length)
			last_nl = woas.parser.NL_MARKER+arguments[arguments.length-3];
		else last_nl = "";
		return woas.parser._HR.repeat(n)+last_nl;
*/	})
	// tables-parsing pass  TODO: woas.config.new_tables_syntax REMOVE reReapTables
	.replace(woas.config.new_tables_syntax ? reReapTablesNew : reReapTables,
				woas.config.new_tables_syntax ? this.parse_tables_new : this.parse_tables)
	
	// cleanup \n after headers and lists
	.replace(reCleanupNewlines, function (str, $1, $2, $3, trailing_nl) {
		if (trailing_nl.length>2)
			return $1+trailing_nl.substr(2);
		return $1;
	})

	// remove \n before list start tags
	.replace(/\n(<[uo]l>)/g, "$1")
	
	// clear dynamic newlines
	.replace(this.reNL_MARKER, "")

	// convert newlines to br tags
	.replace(/\n/g, "<"+"br />");
	// put back in place all snippets
	this.undry(P, snippets);	
//alert(P.body)
	snippets = null;
};

// render a single wiki link
woas.parser._render_wiki_link = function(arg1, label, snippets, tags, export_links) {
	// apply aliases to page title
	var page = woas.title_unalias(arg1),
		hashloc = page.indexOf("#"),
		gotohash = "", r,
		r_label = label? label:page;
		if(r_label.match(woas.parser.reBaseSnippet)) {
			var b={body: r_label};
			woas.parser.undry(b,snippets);
			r_label = b.body;
		}
	// check for protocol links
	if (page.match(/^\w+:\/\//)) {
		r = woas.parser.place_holder(snippets.length);
		// convert mailto:// to mailto:
		page = page.replace(reMailto, "mailto:");
		// always give title attribute
		snippets.push("<"+"a title=\""+woas.xhtml_encode(page)+"\" class=\"woas_world_link\" href=\"" + page +
			"\" target=\"_blank\">" + r_label + "<\/a>");
		return r;
	}
	
	// check for tags definitions
	if (typeof tags == "object") {
		var found_tags = woas._get_tags(page, label);
		if (found_tags.length > 0) {
			// do not use concat because 'tags' is passed byref
			for(var i=0,it=found_tags.length;i<it;++i) {
				tags.push(found_tags[i]);
			}
			if (!this.force_inline)
				return "";
			++this.inline_tags;
			return "<!-- "+woas.parser.marker+":"+inline_tags+" -->";
		}
	}

	if (hashloc > 0) {
		if (export_links)
			gotohash = page.substr(hashloc);
		else
			// PVHL: line below was causing hash location encoding to fail.
//			gotohash = "; window.location.hash= \"" + page.substr(hashloc) + "\"";
			//gotohash = "; window.location.hash='" + page.substr(hashloc) + "'" + ';woas.rescroll();';
			gotohash = "; woas.scrollTo('"+page.substr(hashloc+1)+"');";
		page = page.substr(0, hashloc);
	}

	// get a snippet id which we will later fill
	r = woas.parser.place_holder(snippets.length);
	// create a title attribute only when page URI differs from page title
	var _c_title = (page !== label) ? ' title="'+woas.xhtml_encode(page)+'"' : '', wl;
	if (hashloc === 0) { // section reference URIs
		snippets.push("<"+"a"+_c_title+' class="woas_link" '
		+ ' onclick="window.setTimeout(woas.rescroll,0);return true;" '
		+ " href=\""+page+"\">" + r_label + "<\/a>");
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

// take away macros, nowiki, comments blocks
woas.parser.dry = function(P, NP, snippets) {
	// put away text in XHTML comments and nowiki blocks
	NP.body = P.body.replace(reComments, function (str, $1, dynamic_nl) {
		var r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
		snippets.push(str);
		return r;
	}).replace(reNowiki, function (str, $1, dynamic_nl) {
		var r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
		snippets.push(str);
		return r;
	}).replace(reMacros, function (str, $1, dynamic_nl) {
		var r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
		snippets.push(str);
		return r;
	});
};

woas.parser.undry = function(NP, snippets) {
	if (!snippets.length) return;
	NP.body = NP.body.replace(this.reBaseSnippet, function (str, $1) {
		return snippets[parseInt($1)];
	});
};

