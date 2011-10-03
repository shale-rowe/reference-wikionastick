// returns link exclusive of Include:: and any section or alternate text
var reAllWikiLinks = /\[\[(?:Include\:\:)?([^\|\]\#]+)(?:[^\]]*)?\]\]/g;

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
		return this._join_list(pg);
};

// PVHL: original algorithm was O(n*n) - this one is O(n).
// found contains every non-reserved page
// links contains every wiki link found in the page source
// ns contains every namespace found for page titles
woas.special_orphaned_pages = function() {
	var found = {}, links = {}, ns = {}, lnks, lnk, pg = [],
		i, il, t, tmp;
	// find all titles and namespaces in titles
	for (i = 0, il = page_titles.length; i < il; i++) {
		t = page_titles[i]; // to simplify reading
		if (!this.is_reserved(t)) {
			found[t] = true;
			if (!this.is_menu(t)) {
				tmp = this.get_namespace(t);
				if (tmp) {
					ns[tmp] = true;
				}
			}
		}
	}
	// find all links in pages
	for (i = 0, il = page_titles.length; i < il; i++) {
		t = page_titles[i]; // to simplify reading
		if (found[t] && (tmp = this.get_src_page(i))) {
			while((lnks = reAllWikiLinks.exec(tmp)) !== null) {
				lnk = this.title_unalias(this.trim(lnks[1]));
				if (lnk !== t && found[lnk]) {
					// don't care what kind of link it is
					links[lnk] = true;
				}
			}
		}
	}
	// check pages are linked
	for (t in found) {
		if (found.hasOwnProperty(t)) {
			if (this.is_menu(t)) {
				// check if the menu namespace has a page
				tmp = this.get_namespace(t);
				if (t === "::Menu" || tmp && ns[tmp]) {
					continue;
				}
			} else {
				// check if title has been found in pages
				if (links[t]) {
					continue;
				}
			}
			pg.push(t);
		}
	}
	if (!pg.length)
		return "/No orphaned pages found/";
	else
		return this._join_list(pg);
};

woas.special_backlinks = function() {
	var pg = [], pg_title, tmp;
	if (this.parser.render_title === null)
		pg_title = current;
	else {
		pg_title = this.parser.render_title;
		this.parser.render_title = null;
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

woas.special_tagged = function(filter_string) {
	var	reFindTags = /\[\[Tags?::([^\]]+)\]\]/g,
		pg = [], pgi = [], folds = {}, tags, tag, tagns, alltags,
		src, i, il, j, jl, k, kl, tmp, filtering;
	// filtering setup
	if (typeof filter_string != "undefined") {
		filtering = woas.tagging._prepare_filter(filter_string);
	} else {
		filtering = false;
	}
	// scan all pages
	for(i = 0, il = pages.length; i < il; ++i) {
		if (this.is_reserved(page_titles[i]))
			continue;
		src = this.get_src_page(i);
		// encrypted w/o key
		if (src === null)
			continue;
		src.replace(reFindTags, function (str, $1) {
				// get the tags and index the page under each tag
				tmp = woas.parser.split_tags($1);
				alltags = [];
				for(j = 0, jl = tmp.length; j < jl; ++j) {
					tag = woas.trim(tmp[j]);
					// skip invalid tags
					if (!tag.length) {
						woas.log("WARNING: check your tag separators");
						continue;
					}
					// call the filtering callback, if necessary
					if (filtering) {
						// skip this page from listing in case of negative filter result
						if (!woas.tagging._filter_not_cb(tag))
							break;
					}
					alltags.push(tag);
				}
				tmp = null;
				// check that page has at least one of the positive tags
				if (filtering && !woas.tagging._filter_ok_cb(alltags))
					return;
				// add page to proper leaves
				for (j = 0, jl = alltags.length; j < jl; ++j) {
					tag = alltags[j];
					if (filtering && !woas.tagging._filter_ok_tag(tag)) {
						continue;
					}
					// we have a valid tag, check if it is already indexed
					if (!folds[tag]) {
						folds[tag] = [page_titles[i]];
					} else {
						folds[tag].push(page_titles[i]);
					}
					// build the flat list with tags listed
					if (!pgi[i]) {
						pgi[i] = true;
						tags = alltags.slice(0).sort();
						tmp = "[["+page_titles[i]+"]]\n** [[Tagged::"+tags.join()+"|Tags]]: ";
						for (k = 0, kl = tags.length; k < kl;) {
							tmp += " [[Tagged::"+tags[k]+"|"+tags[k]+"]]"+(++k === kl ? "" : ", ");
						}
						pg.push(tmp);
					}
				}
			});
	} // scan pages loop
	pgi = null;
	if (filtering) {
		woas.tagging._finish();
	}
	if (pg.length) {
		// parse tree with sorting
		return woas.ns_listing("", pg, folds);
	} else {
		return "/No tagged pages found/";
	}
};

// @module 'tagging'
woas.tagging = {
	tags_ok: null,
	tags_not: null,

	_finish: function() {
		this.tags_ok = this.tags_not = null;
	},

	_prepare_filter: function(filter_string) {
		var i,l, pg = [];
		// allow tags filtering/searching
		var tags = woas.parser.split_tags(filter_string);
		// reset filter
		this.tags_ok = [];
		this.tags_not = [];

		// parse filter
		for(i=0,l=tags.length;i < l;++i) {
			// skip empty tags
			var tag = woas.trim(tags[i]);
			if (!tags[i].length)
				continue;
			// add a negation tag
			if (tags[i].charAt(0) === '!')
				this.tags_not.push( tags[i].substr(1) );
			else // normal match tag
				this.tags_ok.push(tags[i]);
		}
		tags = null;
		return (this.tags_ok.length + this.tags_not.length > 0);
	},

	// return true if all OK tags are present
	_filter_ok_cb: function(tags) {
		var ok = 0;
		if (this.tags_ok.length) {
			for(var i=0,il=tags.length;i < il;++i) {
				if (this.tags_ok.indexOf(tags[i]) !== -1)
					++ok
			}
		}
		return (ok === this.tags_ok.length);
	},

	// check single tag is in OK filter
	_filter_ok_tag: function(tag) {
		return this.tags_ok.indexOf(tag) !== -1;
	},

	_filter_not_cb: function(tag) {
		// filter if "NOT" tag is present
		// we are applying this filter only to tagged pages
		// so a page without tags at all does not fit into this filtering
		if (this.tags_not.length) {
			if (this.tags_not.indexOf(tag) !== -1)
				return false;
		}
		// no failure, this page passes
		return true;
	}
		
};

var reHasTags = /\[\[Tags?::[^\]]+\]\]/;
woas.special_untagged = function() {
	var tmp;
	var pg = [];
	for(var i=0,l=pages.length; i < l; i++) {
		if (this.is_reserved(page_titles[i]))
			continue;
		tmp = this.get_src_page(i);
		if (tmp === null)
			continue;
		if (!tmp.match(reHasTags))
			pg.push(page_titles[i]);
	}
	if (!pg.length)
		return '/No untagged pages/';
	return this._join_list(pg);
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
woas.special_dead_pages = function() {
	var dead_pages = [], from_pages = [], pg = [],
		reIgnore = /^(\w+:\/\/|Tags?::|Tagged::|mailto:|Special::TOC)/i,
		tmp, page_done, i, j, l, p, sectref;
	for(j=0,l=pages.length;j < l;j++) {
		if (this.is_reserved(page_titles[j]) && !this.tweak.edit_override)
			continue;
		tmp = this.get_src_page(j);
		if (tmp===null)
			continue;
		page_done = false;
		tmp.replace(reAllWikiLinks,
			function (str, $1, $2, $3) {
				p = woas.trim(woas.title_unalias($1));
				// ignore external and reserved links
				if (reIgnore.test(p)) {
					return;
				}
				if ((p.substr(0, 9) === "Special::") &&
					(woas.shortcuts.indexOf(p.substr(9)) !== -1))
					return;
				if (!woas.page_exists(p) && (p!==page_titles[j])) {
					// true when page has been scanned for referrals
					page_done = false;
					// check that this not-existing page is already in the deads page list
					for(i=0;i < dead_pages.length;i++) {
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
	for(var i=0;i < dead_pages.length;i++) {
		j = from_pages[i];
		l = j.length;
		pg.push("[["+dead_pages[i]+"]] from " + (l ? "[[" : "") +
			j.sort().join("]], [[") + (l ? "]]" : ""));
	}

	woas.pager.bucket.items = dead_pages.slice(0);
	if (!pg.length)
		return '/No dead pages/';
	return this._simple_join_list(pg, true);
};

// used in Special::Options
function bool2chk(b) {
	if (b) return "checked";
	return "";
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
		pg.push("* [[" + page_titles[hm[i][0]] + "]]&nbsp; <"+"span style=\"font-size: smaller;\">"+this.last_modified(hm[i][1],true)+"<"+"/span>");
	}
	if (!pg.length)
		return "/No recently modified pages/";
	return this._simple_join_list(pg);
};

woas._simple_join_list = function(arr, sorted) {
	if (sorted) { arr = arr.sort(); }
	return arr.join("\n")+"\n";
};

// creates a tree from array then sorts and creates listing
woas._join_list = function(arr) {
	if (!arr.length) { return ""; }
	// copy the array to currently selected pages
	woas.pager.bucket.items = arr.slice(0);
	var root = "::", ns = {}, folds = {}, i, il, tmp;
	folds[root] = [];
	for (i = 0, il = arr.length; i < il; ++i) {
		tmp = this.get_namespace(arr[i]);
		if (tmp === "::") {
			tmp = "";
		}
		if (tmp && !folds[tmp]) {
			folds[tmp] = [arr[i]];
		} else {
			folds[tmp ? tmp : root].push(arr[i]);
		}
	}
	return this.ns_listing(root, arr, folds);
};

function _WoaS_list_expand_change(list, list_id, count) {
	var i, s;
	// store selected option in global config variable
	woas.config.folding_style = list.selectedIndex;
	switch (woas.config.folding_style) {
		case 1: // collapse all
			d$.show(list_id+"folds");
			d$.hide(list_id+"flat");
			for(i = 0; i < count; ++i) {
				d$.hide(list_id + i);
			}
		break;
		case 0: // flat list
			d$.hide(list_id+"folds");
			d$.show(list_id+"flat");
			break;
		case 2: // expand all
			d$.show(list_id+"folds");
			d$.hide(list_id+"flat");
			for(i = 0; i < count; ++i) {
				d$.show(list_id + i);
			}
		break;
	}
}

// PVHL: have removed non-functional list caching until it can be made to work
// (cache needs to be invalidated after edit/import, etc; should work off of history)
// listing is always sorted
// flat_arr must have content
woas.ns_listing = function(root, flat_arr, folds) {
	dsp = function(v){
		return v ? "display:block" : "display:none";
	};
	opt = function(str) {
		return "<"+"option "+(fs === opt_n++ ? "selected=\"selected\"" : "" ) +
			">"+str+"<"+"/option>\n";
	};

	var order = [], root_title = "/No Namespace/", fold_n = 0, opt_n = 0, s = "",
		list_id = "woas_"+_random_string(6)+"_", f, i, il, it, oi, ns, fs;
	flat_arr.sort();
	// sort folds content and folds
	// do not produce the header if listing is transcluded
	if (!woas.parser._transcluding) {
		for (f in folds) {
			if (folds.hasOwnProperty(f)) {
				folds[f].sort();
				if (f !== root) {
					order.push(f);
				}
			}
		}
		f = false;
		// or if it has no subnamespaces
		if (order.length) {
			order.sort();
			f = true;
		}
		if (root && folds[root].length) {
			order.splice(0, 0, root);
		}
	};
	if (f) {
		// create list control
		fs = woas.config.folding_style;
		s = "<"+"div class=\"woas_list_options\">List view:&nbsp;<" +
			"select onchange=\"_WoaS_list_expand_change(this,'"+list_id+"',[" +
			order.length+"])\">\n" + opt("Pages") +
			opt(root ? "Namespace, collapsed" : "Tags, collapsed") +
			opt(root ? "Namespace, expanded" : "Tags, expanded") +
			"<"+"/select>\n<"+"/div>\n<"+"div style=\""+dsp(fs !== 0) +
			"\" id=\""+list_id+"folds\">\n"+(root ? "" : "==Tags\n");
		// fill the folding divs
		for (i = 0, il = order.length; i < il; ++i) {
			fold_id = list_id + fold_n++;
			oi = order[i];
			if (root) {
				ns = i === 0 && oi === root ? root_title : "[["+oi+"]]";
			} else {
				ns = "[[Tagged::"+oi+"|"+oi+"]]";
			}
			it = folds[oi].length;
			s += "<"+"div"+" class=\"woas_list_heading\">"+ns+"&nbsp;&nbsp;<" +
				"a class=\"woas_list_link\" title=\"Toggle page display\" onclick=\"d$.toggle('" +
				fold_id+"')\">"+it+" page"+(it > 1 ? "s" : "")+"<"+"/a>\n<"+"/div>\n" +
				"<"+"div style=\""+dsp(fs === 2)+"\" id=\""+fold_id+"\">\n<" + 
				"div class=\"woas_list\">\n[["+folds[oi].join("]]\n[[")+"]]<"+"/div><"+"/div>\n";
		}
		// finish up
		s += "<"+"/div>\n"+
			"<"+"div style=\""+dsp(fs === 0)+
			"\" id=\""+list_id+"flat\">\n";
	}
	// generate the flat list
	s += root ? "* [["+flat_arr.join("]]\n* [[")+"]]\n" : "==Pages\n* "+flat_arr.join("\n* ")+"\n";
	if (f) {
		s += "<"+"/div>";
	}
	return s;
};

woas._special_image_gallery = function(ns) {
	var iHTML = "", snippets, P = {body:null};
	for(var i=0, l=page_titles.length;i < l;++i) {
		if (page_titles[i].indexOf(ns)===0) {
		snippets = [];
		P.body = "* "+this.parser.transclude(page_titles[i], snippets)+" [["+page_titles[i]+"]]\n";
		this.parser.syntax_parse(P, snippets);
		iHTML += P.body;
		snippets = P.body = null;
		}
	}
	return "= Pages in "+ns+" namespace\n" + iHTML;
};
