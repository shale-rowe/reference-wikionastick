woas.special_encrypted_pages = function(locked) {
	var pg = [];
	for(var i=0,l=pages.length;i < l;i++) {
		if (this.is_reserved(page_titles[i]))
			continue;
		if (locked == this.is__encrypted(i))
			pg.push(page_titles[i]);
	}
	if (!pg.length)
		return "/No locked pages found/";
	else
		return this._join_list(pg); // TODO - Delete repeated data
};

woas.special_orphaned_pages = function() {
	var pg = [],
		found = false,
		i, j, l, tmp;
	for(j=0,l=page_titles.length; j < l; j++) {
		if (this.is_reserved(page_titles[j]))
			continue;
		if (this.is_menu(page_titles[j])) {	// check if the namespace has some pages
			var ns = this.get_namespace(page_titles[j]);
			if (ns === "") continue;
			for(i=0;i < page_titles.length;i++) {
				if (page_titles[i].indexOf(ns)===0) {
					found = true;
					break;
				}
			}
		} else {
		// search for pages that link to it
			var re = new RegExp("\\[\\[" + RegExp.escape(page_titles[j]) + "(\\]\\]|\\|)", "i");
			for(i=0,l=page_titles.length; i < l; i++) {
				if ((i==j) || this.is_reserved(page_titles[i]))
					continue;
				tmp = this.get_src_page(i);
				if (tmp===null)
					continue;
				if (tmp.search(re)!=-1) {
					found = true;
					break;
				}
			}
		}
		if(found === false) {
			pg.push( page_titles[j] );
		} else found = false;
	}
	if (!pg.length)
		return "/No orphaned pages found/";
	else
		return this._join_list(pg); // TODO - Delete repeated data
};

woas.special_backlinks = function() {
	var pg = [], pg_title, tmp;
	if (this.render_title === null)
		pg_title = current;
	else {
		pg_title = this.render_title;
		this.render_title = null;
	}
	var reg = new RegExp("\\[\\["+RegExp.escape(pg_title)+"(\\||\\]\\])", "gi");
	for(var j=0,l=pages.length; j < l; j++) {
		if (this.is_reserved(page_titles[j]))
			continue;
		// search for pages that link to it
		tmp = this.get_src_page(j);
		// encrypted w/o key
		if (tmp===null)
			continue;
		if (tmp.match(reg))
			pg.push( page_titles[j] );
	}
	if(pg.length === 0)
		return "/No page links to [["+pg_title+"]]/";
	else
		return "== Links to [["+pg_title+"]]\n"+this._join_list(pg);
};

woas._reLastSearch = null;	// search highlighting regex

woas._nearby_chars = 200;		// amount of nearby characters to display

// cached search results
woas._cached_title_search = [];
woas._cached_body_search = [];
// last string searched
woas._last_search = null;

// create an index of searched pages (by miz & legolas558)
woas._cache_search = function( str ) {
	var count = 0, tmp,
		// matches the search string and nearby text
		reg = new RegExp( ".{0,"+this._nearby_chars+"}" + RegExp.escape(this.trim(str)).
					replace(/\s+/g, "(.|\n)*?") + ".{0,"+this._nearby_chars+"}", "gi" );

	this._reLastSearch = new RegExp("("+RegExp.escape(str)+")", "gi");
	
	this._last_search = str;

	for(var i=0,l=pages.length; i < l; i++) {

		//TODO: implement searching in help pages

		if (this.is_reserved(page_titles[i]) && !this.tweak.edit_override)
			continue;

		// this could be modified for wiki searching issues
		tmp = this.get_src_page(i, true);
		if (tmp===null)
			continue;
	
		// look for string in title
		if(page_titles[i].match(reg)) {
			this._cached_title_search.push(page_titles[i]);
		}

		// look for string in body
		res_body = tmp.match(reg);
		if (res_body !== null)
			this._cached_body_search.push( { title: page_titles[i],	 matches: res_body} );
	}
};

var reFindTags = /\[\[Tags?::([^\]]+)\]\]/g;
woas.special_tagged = function() {
	var	pg = [], folds = {"[pages]":[]}, tagns,
		src, i, l, j, jl, tmp, tag;
		
	for(i=0,l=pages.length;i < l;++i) {
		if (this.is_reserved(page_titles[i]))
			continue;
		src = this.get_src_page(i);
		// encrypted w/o key
		if (src === null)
			continue;
		src.replace(reFindTags,
			function (str, $1) {
				// get the tags and index the page under each tag
				tmp=woas.split_tags($1);
				for(j=0,jl=tmp.length;j < jl; ++j) {
					tag=woas.trim(tmp[j]);
					if (!tag.length) continue;
					// we have a valid tag, check if it is already indexed
					tagns = "Tagged::"+tag;
					if (typeof folds[tagns] == "undefined") {
						folds[tagns] = {"[pages]":[page_titles[i]]};
					} else
						folds[tagns]["[pages]"].push(page_titles[i]);
					// build also the flat list
					pg.push(page_titles[i]);
				}
			});
	}
	// parse tree with sorting
	return woas.ns_listing(folds, pg, false);
};

var reHasTags = /\[\[Tags?::([^\]]+)\]\]/;
woas.special_untagged = function() {
	var tmp;
	var pg = [];
	for(var i=0,l=pages.length; i < l; i++) {
		if (this.is_reserved(page_titles[i]))
			continue;
		tmp = this.get_src_page(i);
		if (tmp===null)
			continue;
		if (!tmp.match(reHasTags))
			pg.push(page_titles[i]);
	}
	if (!pg.length)
		return '/No untagged pages/';
	return this._join_list(pg, true);
};

// Returns a index of all pages
woas.special_all_pages = function() {
	var pg = [];
	for(var i=0, l=page_titles.length; i < l; i++) {
		if (!this.is_reserved(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return this._join_list(pg);
};

// Returns a index of all dead pages
var reAllWikiLinks = /\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g;
woas.special_dead_pages = function() {
	var dead_pages = [];
	var from_pages = [];
	var tmp, page_done;
	for(var j=0,l=pages.length;j < l;j++) {
		if (this.is_reserved(page_titles[j]) && !this.tweak.edit_override)
			continue;
		tmp = this.get_src_page(j);
		if (tmp===null)
			continue;
		page_done = false;
		tmp.replace(reAllWikiLinks,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
				var p = woas.title_unalias($1),
					sectref = p.indexOf("#");
				if (sectref === 0)
					return;
				else if (sectref > 0)
					p = p.substr(0, sectref);
				if (p.search(/^\w+:\/\//)===0)
					return;
				if (p.match(/Tag(s|ged)?:/gi))
					return;
				// skip mailto URLs
				if (p.match(/^mailto:/gi))
					return;
				if (p === "Special::TOC")
					return;
				if ((p.substr(0, 9) === "Special::") &&
					(woas.shortcuts.indexOf(p.substr(9)) !== -1))
					return;
				if (!woas.page_exists(p) && (p!==page_titles[j])) {
					// true when page has been scanned for referrals
					page_done = false;
					// check that this not-existing page is already in the deads page list
					for(var i=0;i < dead_pages.length;i++) {
						// current page contains a link to an already indexed dead page,
						// save the reference
						if (dead_pages[i]===p) {
							// add only if not already there
							if (from_pages[i].indexOf(page_titles[j]) === -1)
								from_pages[i].push(page_titles[j]);
							page_done = true;
							break;
						}
					}
					// we have just found a dead page
					if (!page_done) {
						dead_pages.push(p);
						from_pages.push(new Array(page_titles[j]));
						page_done = true;
					}
				}
	        }
		);
	}

	// format the dead pages
	var pg = [], s;
	for(var i=0;i < dead_pages.length;i++) {
		s = "[["+dead_pages[i]+"]] from ";
		var from = from_pages[i];
		for(j=0;j < from.length-1;j++) {
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
};

// used in Special::Options
function bool2chk(b) {
	if (b) return "checked";
	return "";
}

$.checked = function(id) {
	cfg_changed = true;
	if ($(id).checked)
		return true;
	return false;
};

// Used by Special::Options
function _set_layout(fixed) {
	$("sw_menu_area").style.position = $("sw_wiki_header").style.position = (fixed ? "fixed" : "absolute");
}

//Special::Recentchanges shows a sorted list of pages by modified timestamp
woas.special_recent_changes = function() {
	if (!this.config.store_mts) {
		return "/Last modified timestamp storage is disabled in [[Special::Options]]./";
	}
	// build an array of (key := page_index, val := last_modified_timestamp) couples
	var l=page_titles.length, hm = [], i;
	for(i=0;i < l;++i) {
		// skip pages with the 'magic' zero timestamp
		if (page_mts[i] === 0)
			continue;
		// skip reserved pages which are not editable
		if (!this.edit_allowed_reserved(page_titles[i]) && this.is_reserved(page_titles[i]))
			continue;
		hm.push([i,page_mts[i]]);
	}
	// sort the array
	hm.sort(function(a,b) { return (b[1]-a[1]); });
	// display results
	var pg=[];
	for(i=0,l=hm.length;i < l;++i) {
		pg.push("* [[" + page_titles[hm[i][0]] + "]] <"+"span style=\"font-size: smaller;\">"+this.last_modified(hm[i][1])+"<"+"/span>");
	}
	if (!pg.length)
		return "/No recently modified pages/";
	return this._simple_join_list(pg);
};

woas._simple_join_list = function(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	// a newline is added here
	return arr.join("\n")+"\n";
};

// joins a list of pages - always sorted by default
woas._join_list = function(arr, sorted) {
	if (!arr.length)
		return "";
	if (typeof sorted == "undefined")
		sorted = true;
	// copy the array to currently selected pages
	result_pages = arr.slice(0);
	// (1) create a recursable tree of namespaces
	var ns,folds={"[pages]":[]},i,ni,nt,key;
	for(i=0,it=arr.length;i < it;++i) {
		ns = arr[i].split("::");
		// remove first entry if empty
		if (ns.length>1) {
			// in case of special menu pages
			if (ns[0].length === 0) {
//				ns.shift();
//				ns[0] = "::"+ns[0];
				// this shan't be a namespace
			} else if (ns[ns.length-1].length === 0) {
				// namespace pages, do nothing and consider them as normal pages
			} else { // pages with some namespace, recurse their namespaces and finally the page
				this.ns_recurse(ns, folds, "");
				continue;
			}
		}
		folds["[pages]"].push(arr[i]);
	}
	// (2) output the tree
	return this.ns_listing(folds, arr, sorted);
};

woas.ns_recurse = function(ns_arr, folds, prev_ns) {
	var ns = prev_ns+ns_arr.shift()+"::", item, left=ns_arr.length;;
	if (typeof folds[ns] == "undefined") {
		// last item, build the array
		if (left == 1) {
			folds[ns] = {"[pages]": [ns+ns_arr[0]] };
			return;
		}
		// namespace, create object
		folds[ns] = {"[pages]":[]};
	} else { // object already exists, add only leaves
		if (left == 1) {
			folds[ns]["[pages]"].push(ns+ns_arr[0]);
			return;
		}
	}
	if (left > 1)
		this.ns_recurse(ns_arr, folds, ns);
};

// grab expansion setting from UI radio boxes
woas._ns_expanded = function(ns, items_count, id, list_id) {
	this._ns_groups[list_id].items.push(id);
	switch (this._ns_groups[list_id].option) {
		case 1:
			return false;
		case 2:
			return true;
	}
	// ?
	return false;
};

woas._visible_css = function(v){
	return v ? "visibility: visible; display: inline" : "visibility: hidden; display: none";
}

woas.ns_recurse_parse = function(folds, output, prev_ns, recursion, sorted) {
	var i,it=folds["[pages]"].length,fold_id;
	if (it !== 0) {
		// increase recursion depth
		++recursion;
		// disable folding for pages outside namespaces
		if (prev_ns.length) {
			// generate id for folding div
			fold_id = "woas_fold"+output.fold_no++;
			var vis_css = woas._visible_css(this._ns_expanded(prev_ns, it, fold_id, output.list_id));
			output.s += "<"+"h"+(recursion+1)+" id=\""+fold_id+"_head\"> [[Javascript::$.toggle('"+fold_id+"')|"+prev_ns+"]]";
			output.s += " [["+prev_ns+"|"+String.fromCharCode(8594)+"]] ("+it+" pages)\n<"+"/h"+(recursion+1)+">";
			output.s += "<"+"div style=\""+vis_css+"\" id=\""+fold_id+"\">\n";
		}
		// apply sorting
		if (sorted)
			folds["[pages]"].sort();
		for(i=0;i < it;++i) {
			output.s += "* [["+folds["[pages]"][i]+"]]\n";
		}
		if (prev_ns.length)
			output.s += "<"+"/div>";
	}
	// sort the actual namespaces
	if (sorted) {
		var nslist=[];
		// get namespaces
		for(i in folds) {
			if (i !== "[pages]")
				nslist.push(i);
		}
		// sort alphabetically (case insensitive)
		nslist.sort(function(x,y){
		  var a = String(x).toUpperCase();
		  var b = String(y).toUpperCase();
		  if (a > b)
			 return 1;
		  if (a < b)
			 return -1;
		  return 0;
		});
		// parse second the sorted namespaces
		it=nslist.length;
		for(i=0;i < it;++i) {
			this.ns_recurse_parse(folds[nslist[i]], output, prev_ns+nslist[i], recursion, sorted);
		}
	} else { // directly parsed without any specific sorting
		for(i in folds) {
			if (i !== "[pages]") {
				this.ns_recurse_parse(folds[i], output, prev_ns+i, recursion, sorted);
			}
		}
	}
};

// cache of current namespace listings
woas._ns_groups = {};

function _WoaS_list_expand_change(list_id, v) {
	// store selected option both in global config variable and
	// in relative list option
	woas.config.folding_style = woas._ns_groups[list_id].option = parseInt(v);
	switch (woas._ns_groups[list_id].option) {
		case 1: // collapse all
			$.show("WoaS_"+list_id+"_folds");
			$.hide("WoaS_"+list_id+"_flat");

			for(var i=0,it=woas._ns_groups[list_id].items.length;i < it;++i) {
				$.hide(woas._ns_groups[list_id].items[i]);
			}
		break;
		case 0: // flat list
			$.hide("WoaS_"+list_id+"_folds");
			$.show("WoaS_"+list_id+"_flat");
			break;
		case 2: // expand all
			$.show("WoaS_"+list_id+"_folds");
			$.hide("WoaS_"+list_id+"_flat");

			for(var i=0,it=woas._ns_groups[list_id].items.length;i < it;++i) {
				$.show(woas._ns_groups[list_id].items[i]);
			}
		break;
	}
}

woas.ns_listing = function(folds, flat_arr, sorted) {
	if (flat_arr.length === 0)
		return "/No pages in this listing/";
	if (typeof sorted == "undefined")
		sorted = false;
	// this is kept here for now until some more appropriate place is individuated
	var list_id = _random_string(8);
	// setup the group object
	this._ns_groups[list_id] = { "items":[], "option": woas.config.folding_style};
	var output={	"s": "",
					"fold_no":0,
					"list_id":list_id
	};
	output.s = "<"+"span class=\"woas_listing_options\">List view:<"+"label for=\"WoaS_"+list_id+"_0\"><"+"input type=\"radio\" id=\"WoaS_"+list_id+"_0\" name=\"WoaS_"+list_id+"\" value=\"0\" "+(this._ns_groups[list_id].option === 0 ? " checked=\"checked\"" : "" )+"onclick=\"_WoaS_list_expand_change('"+list_id+"',0)\">Flat<"+"/label>&nbsp;|\
<"+"label for=\"WoaS_"+list_id+"_1\"><"+"input type=\"radio\" id=\"WoaS_"+list_id+"_1\" name=\"WoaS_"+list_id+"\" value=\"1\" "+(this._ns_groups[list_id].option === 1 ? " checked=\"checked\"" : "" )+"onclick=\"_WoaS_list_expand_change('"+list_id+"',1)\" >By namespace, collapsed<"+"/label>&nbsp;|\
<"+"label for=\"WoaS_"+list_id+"_2\"><"+"input type=\"radio\" id=\"WoaS_"+list_id+"_2\" name=\"WoaS_"+list_id+"\" value=\"2\" "+(this._ns_groups[list_id].option === 2 ? " checked=\"checked\"" : "" )+" onclick=\"_WoaS_list_expand_change('"+list_id+"',2)\">By namespace, expanded<"+"/label>\
<"+"/span><"+"span style=\""+woas._visible_css(this._ns_groups[list_id].option !== 0)+"\" id=\"WoaS_"+list_id+"_folds\">\n";
	
	// first fill the span for foldings
	this.ns_recurse_parse(folds, output, "", 0, sorted);
	output.s += "<"+"/span>\n"+
				"<"+"span style=\""+woas._visible_css(this._ns_groups[list_id].option === 0)+"\" id=\"WoaS_"+list_id+"_flat\">\n";
	// then generate the flat list
	if (flat_arr.length) {
		if (sorted)
			flat_arr.sort();
		output.s += "* [["+flat_arr.join("]]\n* [[")+"]]\n";
	/*	for(var i=0,it=flat_arr.length;i < it;++i) {
			output.s += "* [["+flat_arr[i]+"]]\n";
		} */
	}
	output.s += "<"+"/span>";
	return output.s;
};
