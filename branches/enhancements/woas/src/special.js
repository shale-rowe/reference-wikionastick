// Here begins the special pages' code

woas["special_encrypted_pages"] = function(locked) {
	var pg = [];
	for(var i=0,l=pages.length;i<l;i++) {
		if (locked == this.is__encrypted(i))
			pg.push(page_titles[i]);
	}
	return this._join_list(pg);
}

woas["special_orphaned_pages"] = function() {
	var pg = [];
	var found = false;
	for(j=0,l=page_titles.length; j<l; j++) {
		if (this.is_reserved(page_titles[j]))
			continue;
		if (this.is_menu(page_titles[j])) {	// check if the namespace has some pages
			var ns = this.get_namespace(page_titles[j]);
			if (ns == "") continue;
			for(var i=0;i<page_titles.length;i++) {
				if (page_titles[i].indexOf(ns)==0) {
					found = true;
					break;
				}
			}
		} else {
		// search for pages that link to it
			var tmp;
			for(var i=0,l=page_titles.length; i<l; i++) {
				if ((i==j) || this.is_reserved(page_titles[i]))
					continue;
				tmp = this.get_src_page(i);
				if (tmp==null)
					continue;
				var re = new RegExp("\\[\\[" + RegExp.escape(page_titles[j]) + "(\\]\\]|\\|)", "i");
//			log("matching "+re+" into "+page_titles[i]);	// log:0
				if (tmp.search(re)!=-1) {
					found = true;
					break;
				}
			}
		}
		if(found == false) {
			pg.push( page_titles[j] );
		} else found = false;
	}
	if (!pg.length)
		return "/No orphaned pages found/";
	else
		return this._join_list(pg); // TODO - Delete repeated data
}

woas["special_backlinks"] = function(page)
{
	var pg = [];
	var tmp;
	var reg = new RegExp("\\[\\["+RegExp.escape(page||current)+"(\\||\\]\\])", "gi");
	for(j=0,l=pages.length; j<l; j++)
	{
		// search for pages that link to it
		tmp = this.get_src_page(j);
		if (tmp==null)
			continue;
		if (tmp.match(reg))
			pg.push( page_titles[j] );
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "== Links to "+(page||current)+"\n"+this._join_list(pg);
}

// var hl_reg;

// Returns a index of search pages (by miz & legolas558)
woas["special_search"] = function( str ) {
	document.body.style.cursor = "wait";
	var pg_body = [];
	var title_result = "";
	log("Searching "+str);
	
	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".{0,30}" + RegExp.escape(this.trim(str)).
					replace(/\s+/g, ".*?") + ".{0,30}", "gi" );
	_hl_reg = new RegExp("("+RegExp.escape(str)+")", "gi");
/*	hl_reg = new RegExp( ".*?" + RegExp.escape(str).
					replace(/^\s+/, "").
					replace(/\s+$/, "").
					replace(/([^\s]+)/g, "($1)").
					replace(/\s+/g, ".*?") + ".*", "gi" );
*/
	var tmp;
	result_pages = [];
	for(var i=0,l=pages.length; i<l; i++) {
		if (this.is_reserved(page_titles[i]))
			continue;
		
		tmp = this.get_src_page(i, 1);
		if (tmp==null)
			continue;
//		log("Searching into "+page_titles[i]);	// log:0
		
		var added = false;
		// look for str in title
		if(page_titles[i].match(reg)) {
			title_result += "* [[" + page_titles[i] + "]]\n";
			result_pages.push(page_titles[i]);
			added = true;
		}

		// Look for str in body
		res_body = tmp.match(reg);
		if (res_body!=null) {
			if (!added)
				result_pages.push(page_titles[i]);
			count = res_body.length;
			res_body = "..."+res_body.join("...\n")+"..."; //.replace(/\n/g, " ");
			pg_body.push( "* [[" + page_titles[i] + "]]: found *" + count + "* times :<div class=\"search_results\">{{{" + res_body +"\n}}}\n</div>");
		}
	}
	document.body.style.cursor = "auto";
	if (!pg_body.length && !title_result.length)
		return "/No results found for *"+str+"*/";
	woas.parser.force_inline = true;
	return "Results for *" + woas.xhtml_encode(str) + "*\n" + title_result + "\n\n----\n" + this._simple_join_list(pg_body, false);
}


woas["special_tagged"] = function() {
	var tag_tree = {}; // new Object();
	var utags = []; // new Array();
	var src,t,tag;
	// making use of faster reverse-for-loop: http://javascript.about.com/library/blloop.htm
	for (var page = pages.length-1; page > -1; page--) {
		src = this.get_src_page(page);
		if(!src)
			continue;
		src.replace(/\[\[Tags?::([^\]]+)\]\]/g,
			function (str, $1) {
				var str=$1.split(",");
				for(var j=str.length-1;j>-1;j--){
					tag=woas.trim(str[j]);
					if(!tag_tree[tag]){
						utags.push(tag);
						tag_tree[tag] = [];
					}
					tag_tree[tag].push(page_titles[page]);	
				}
			}
		);
	}
	var s="";
	utags = utags.sort(); // Case Insensitive sort? put inside the sort:  .sort($["i_sort"])
	for(var j=0, l=utags.length;j<l;j++) {
		s += "\n== [[Tagged::"+utags[j]+"]]\n";
		t = tag_tree[utags[j]].sort();
		for(var i=0;i<t.length;i++) {
			s+="* [["+t[i]+"]]\n";
		}
	}
	return s;
}

woas["special_untagged"] = function() {
	var tmp;
	var pg = [];
	for(var i=0,l=pages.length; i<l; i++) {
		tmp = this.get_src_page(i);
		if (tmp==null)
			continue;
		if (!tmp.match(/\[\[Tags?::([^\]]+)\]\]/))
			pg.push("[["+page_titles[i]+"]]");
	}
	if (!pg.length)
		return '/No untagged pages/';
	return this._simple_join_list(pg, true);
}

// Returns a index of all pages
woas["special_all_pages"] = function() {
	var pg = [];
	for(var i=0,l=page_titles.length; i<l; i++)
	{
		if (!this.is_reserved(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return this._join_list(pg);
}

// Returns a index of all dead pages
woas["special_dead_pages"] = function() {
	var dead_pages = [];
	var from_pages = [];
	var page_done = false;
	var tmp;
	for (j=0,l=pages.length;j<l;j++) {
		tmp = this.get_src_page(j);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
				if ($1.charAt(0)=="#" || $1.charAt(0)=="[")
					return;
				if ($1.search(/^\w+:\/\//)==0)
					return;
				if ($1.match(/(?:Tag(?:s|ged)?|mailto)?:/gi))
					return;
				p = $1;
				if (!woas.page_exists(p) && (p!=page_titles[j])) {
					for(var i=0;i<dead_pages.length;i++) {
						if (dead_pages[i]==p) {
							from_pages[i].push(page_titles[j]);
							page_done = true;
							break;
						}
					}
					if (!page_done) {
						dead_pages.push(p);
						from_pages.push(new Array(page_titles[j]));
						page_done = true;
					}
				}
	        }
		);
		page_done = false;
	}

	var pg = [], s;
	for(var i=0;i<dead_pages.length;i++) {
		s = "[["+dead_pages[i]+"]] from ";
		var from = from_pages[i];
		for(j=0;j<from.length-1;j++) {
			s+="[["+from[j]+"]], ";
		}
		if (from.length>0)
			s+="[["+from[from.length-1]+"]]";
		pg.push(s);
	}

  result_pages = dead_pages;	
  if (!pg.length)
	return '/No dead pages/';
	return this._simple_join_list(pg, true);
}

// used in Special::Options
function bool2chk(b) {
	if (b) return "checked";
	return "";
}

$["checked"] =function(id) {
	cfg_changed = true;
	if ($(id).checked)
		return true;
	return false;
}

// Used by Special::Options
function _set_layout(fixed) {
	$("sw_menu_area").style.position = $("sw_wiki_header").style.position = (fixed ? "fixed" : "absolute");
}

// End of special pages' code