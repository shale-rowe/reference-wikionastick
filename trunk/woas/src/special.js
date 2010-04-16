woas.special_encrypted_pages = function(locked) {
	var pg = [];
	for(var i=0,l=pages.length;i<l;i++) {
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
	for(j=0,l=page_titles.length; j<l; j++) {
		if (this.is_reserved(page_titles[j]))
			continue;
		if (this.is_menu(page_titles[j])) {	// check if the namespace has some pages
			var ns = this.get_namespace(page_titles[j]);
			if (ns === "") continue;
			for(i=0;i<page_titles.length;i++) {
				if (page_titles[i].indexOf(ns)===0) {
					found = true;
					break;
				}
			}
		} else {
		// search for pages that link to it
			var re = new RegExp("\\[\\[" + RegExp.escape(page_titles[j]) + "(\\]\\]|\\|)", "i");
			for(i=0,l=page_titles.length; i<l; i++) {
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
	for(var j=0,l=pages.length; j<l; j++) {
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
		return "/No page links here/";
	else
		return "== Links to "+pg_title+"\n"+this._join_list(pg);
};

//var hl_reg;

// Returns a index of searched pages (by miz & legolas558)
woas.special_search = function( str ) {
	this.progress_init("Searching");
	var pg_body = [];
	var title_result = "";
	log("Searching "+str);	//log:1

	// amount of nearby characters to display
	var nearby_chars = 200;
	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".{0,"+nearby_chars+"}" + RegExp.escape(this.trim(str)).
					replace(/\s+/g, "(.|\n)*?") + ".{0,"+nearby_chars+"}", "gi" );
	_hl_reg = new RegExp("("+RegExp.escape(str)+")", "gi");
/*	hl_reg = new RegExp( ".*?" + RegExp.escape(str).
					replace(/^\s+/, "").
					replace(/\s+$/, "").
					replace(/([^\s]+)/g, "($1)").
					replace(/\s+/g, ".*?") + ".*", "gi" );	*/
	var tmp;
	result_pages = [];
	for(var i=0,l=pages.length; i<l; i++) {
		//TODO: implement searching in help pages
		if (this.is_reserved(page_titles[i]))
			continue;

		// this could be modified for wiki searching issues
		tmp = this.get_src_page(i, true);
		if (tmp===null)
			continue;
//		log("Searching into "+page_titles[i]);	// log:0
	
		var added = false;
		//look for str in title
		if(page_titles[i].match(reg)) {
			title_result += "* [[" + page_titles[i] + "]]\n";
			result_pages.push(page_titles[i]);
			added = true;
		}

		//Look for str in body
		res_body = tmp.match(reg);
		if (res_body!==null) {
			if (!added)
				result_pages.push(page_titles[i]);
			count = res_body.length;
			res_body = "..."+res_body.join("...\n")+"..."; //.replace(/\n/g, " ");
			pg_body.push( "* [[" + page_titles[i] + "]]: found *" + count + "* times :<div class=\"search_results\">{{{" + res_body +"\n}}}\n</div>");
		}
	}
	this.progress_finish();
	if (!pg_body.length && !title_result.length)
		return "/No results found for *"+str+"*/";
	woas.parser.force_inline = true;
	return "Results for *" + woas.xhtml_encode(str) + "*\n" + title_result + "\n\n----\n" + this._simple_join_list(pg_body, false);
};

var reFindTags = /\[\[Tags?::([^\]]+)\]\]/g;
woas.special_tagged = function() {
	var	folds = {"[pages]":[]}, tagns,
		src, i, l, j, jl, tmp, tag;
		
	for(i=0,l=pages.length;i<l;++i) {
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
				for(j=0,jl=tmp.length;j<jl; ++j) {
					tag=woas.trim(tmp[j]);
					if (!tag.length) continue;
					// we have a valid tag, check if it is already indexed
					tagns = "Tagged::"+tag;
					if (typeof folds[tagns] == "undefined") {
						folds[tagns] = {"[pages]":[page_titles[i]]};
					} else
						folds[tagns]["[pages]"].push(page_titles[i]);
				}
			});
	}
	// parse tree with sorting
	return woas.ns_parse_tree(folds, true);
};

woas.special_untagged = function() {
	var tmp;
	var pg = [];
	for(var i=0,l=pages.length; i<l; i++) {
		if (this.is_reserved(page_titles[i]))
			continue;
		tmp = this.get_src_page(i);
		if (tmp===null)
			continue;
		if (!tmp.match(/\[\[Tags?::([^\]]+)\]\]/))
			pg.push(page_titles[i]);
	}
	if (!pg.length)
		return '/No untagged pages/';
	return this._join_list(pg, true);
};

// Returns a index of all pages
woas.special_all_pages = function() {
	var pg = [];
	for(var i=0, l=page_titles.length; i<l; i++) {
		if (!this.is_reserved(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return this._join_list(pg);
};

// Returns a index of all dead pages
woas.special_dead_pages = function() {
	var dead_pages = [];
	var from_pages = [];
	var tmp, page_done;
	for(var j=0,l=pages.length;j<l;j++) {
		if (this.is_reserved(page_titles[j]))
			continue;
		tmp = this.get_src_page(j);
		if (tmp===null)
			continue;
		page_done = false;
		tmp.replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
				if ($1.charAt(0)=="#")
					return;
				if ($1.search(/^\w+:\/\//)===0)
					return;
				if ($1.match(/Tag(s|ged)?:/gi))
					return;
				// skip mailto URLs
				if ($1.match(/^mailto:/gi))
					return;
				var p = woas.title_unalias($1);
				if (!woas.page_exists(p) && (p!=page_titles[j])) {
					// true when page has been scanned for referrals
					page_done = false;
					// check that this not-existing page is already in the deads page list
					for(var i=0;i<dead_pages.length;i++) {
						// current page contains a link to an already indexed dead page,
						// save the reference
						if (dead_pages[i]==p) {
							// add only if not already there
							if (from_pages[i].indexOf(page_titles[j]) == -1)
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
	// build an array of (key := page_index, val := last_modified_timestamp) couples
	var l=page_titles.length, hm = [], i;
	for(i=0;i<l;++i) {
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
	for(i=0,l=hm.length;i<l;++i) {
		pg.push("* [[" + page_titles[hm[i][0]] + "]] <span style=\"font-size: smaller;\">"+this.last_modified(hm[i][1])+"</"+"span>");
	}
	if (!pg.length)
		return "/No recently modified pages/";
	return this._simple_join_list(pg);
};

// joins a list of pages - always sorted by default
woas._join_list = function(arr, sorted) {
	if (!arr.length)
		return "";
	if (typeof sorted == "undefined")
		sorted = true;
	// copy the array to currently selected pages
	result_pages = arr.slice(0);
	//return "* [["+arr.sort().join("]]\n* [[")+"]]";
	// (1) create a recursable tree of namespaces
	var ns,output={"s":"","fold_no":0},folds={"[pages]":[]},i,ni,nt,key;
	for(i=0,it=arr.length;i<it;++i) {
		ns = arr[i].split("::");
		// remove first entry if empty
		if (ns.length>1) {
			if (ns[0].length == 0) {
				ns.shift();
				ns[0] = "::"+ns[0];
			}
			// recurse all namespaces found in page title
			this.ns_recurse(ns, folds, "");
		} else // <= 1
			folds["[pages]"].push(arr[i]);
	}
	// (2) output the tree
	this.ns_recurse_parse(folds, output, "", 0, sorted);
	return output.s;
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

woas._ns_expanded = function(ns, items_count) {
	return (items_count <= 3);
};

woas.ns_recurse_parse = function(folds, output, prev_ns, recursion, sorted) {
	var i,it=folds["[pages]"].length,fold_id;
	if (it != 0) {
		var vis_css = this._ns_expanded(prev_ns, it) ? "visibility: visible" : "visibility: hidden; display:none";
		fold_id = "fold"+output.fold_no++;
		++recursion;
		// disable folding for pages outside namespaces
		if (prev_ns.length) {
			output.s += "=".repeat(recursion)+" [[Javascript::$.toggle('"+fold_id+"')|"+prev_ns+"]]";
			output.s += " [["+prev_ns+"|"+String.fromCharCode(8594)+"]] ("+it+" pages)\n";
			output.s += "<div style=\""+vis_css+"\" id=\""+fold_id+"\">\n";
		}
		if (sorted)
			folds["[pages]"].sort();
		for(i=0;i<it;++i) {
			output.s += "* [["+folds["[pages]"][i]+"]]\n";
		}
		if (prev_ns.length)
			output.s += "</div>\n";
	}
	// sort the actual namespaces
	if (sorted) {
		var nslist=[];
		// get namespaces
		for(i in folds) {
			if (i != "[pages]")
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
		for(i=0;i<it;++i) {
			this.ns_recurse_parse(folds[nslist[i]], output, prev_ns+nslist[i], recursion, sorted);
		}
	} else { // directly parsed without any specific sorting
		for(i in folds) {
			if (i != "[pages]")
				this.ns_recurse_parse(folds[i], output, prev_ns+i, recursion, sorted);
		}
	}
};

woas._simple_join_list = function(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	// a newline is added here
	return arr.join("\n")+"\n";
};

woas.ns_parse_tree = function(folds, sorted) {
	if (typeof sorted == "undefined")
		sorted = false;
	var output={"s":""};
	this.ns_recurse_parse(folds, output, "", 0, sorted);
	return output.s;
};
