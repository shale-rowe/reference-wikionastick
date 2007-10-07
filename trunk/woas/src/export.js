
//TODO: shold be uniform to the other get_page variants
woas["export_get_page"] = function(pi) {
	if (!this.is__encrypted(pi))
		return pages[pi];
	if (!key.length) {
		latest_AES_page = "";
		return null;
	}
	var pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
	last_AES_page = page_titles[pi];
	if (pg===null) return null;
	if (this.is_embedded(pi))
		return decode64(pg);
	return pg;
}

var _export_main_index = false, _export_unix_norm = false,
	_export_default_ext;

var _title2fn;

var _export_fnames_array = [], _export_replace_fname = {};

/*
var utf8_marker = "-"+_random_string(5).toLowerCase()+"-",
	utf8_marker_rx = new RegExp(utf8_marker, "g");
*/

woas["_attrib_escape"] = function(s) {
	return s.replace(/"/g, '&quot;');
}

woas["_export_get_fname"] = function (title, create_mode) {
	// return a cached title
	if (typeof(_title2fn[title]) != 'undefined') {
		if (!create_mode)
			return escape(_title2fn[title]);
		return _title2fn[title];
	}
	var orig_title = title;
	if (title.match(/::$/)) {
		//TODO: offer namespace index page
		_title2fn[title] = "#";
		return "#";
	}
	if (this.is_reserved(title)) {
		//TODO: offer some special pages
		_title2fn[title] = "#";
		return "#";
	}
	var pi=page_titles.indexOf(title);
	if (pi==-1) {
		alert("Page does not exist: "+title);
		_title2fn[title] = "#";
		return "#";
	}
	if (_export_main_index && (title==main_page)) {
		_title2fn[title] = "index."+_export_default_ext;
		_export_fnames_array.push(_title2fn[title]);
		return _title2fn[title];
	}
	var ext = "", emb;
	if (this.is__embedded(pi)) {
		title = title.substr(title.indexOf("::")+2);
		if (!this.is__image(pi))
			ext = "."+_export_default_ext;
		emb = true;
	} else {
		ext = "."+_export_default_ext;
		emb = false;
	}
	var fname = title
	// convert UTF8 characters to something else (cross-browser safe cheap solution)
	.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length, r="";
		for(var i=0;i<l;i++) {
			switch ($1[i]) {
				//TODO: add most common diacritics
				case "\u00e2":
					r+="a";
					break;
				default:
					r+="_";
			}
		}
		return r;
	})
	// escape some path-unsafe characters
	.replace(/[:\\\/<>?#=!]+/g, function($1) {
		return str_rep("_", $1.length);
	});
	
	if (_export_unix_norm)
		fname = fname.toLowerCase().replace(/\s+/g, "_").replace(/::/g, "-");
	else
		fname = fname.replace(/::/g, " - ");
/*
	// place back UTF8 tokens
	if (tokens.length) {
		var token_i = 0;
		fname = fname.replace(utf8_marker_rx, function ($1) {
			var a=split_bytes(tokens[token_i++]);
			var l=a.length, t, r="";
			for(var i=0;i<l;i++) {
				t = a[i].toString(16).toUpperCase();
				r += "%25%"+str_rep("0", 2-t.length)+t;
			}
			return r;
		});
	}	*/
	// be sure that filename is unique - FIXME
/*	if (!create_mode) {
		if (_export_replace_fname[fname+ext]!=null)
			return _export_replace_fname[fname+ext];
		return fname+ext;
	}	*/
	var test_fname = fname+ext, i=0;
	while (_export_fnames_array.indexOf(test_fname)!=-1) {
		log(test_fname+" already created, checking next fname");	// log:1
		test_fname = fname+str_rep("_", ++i)+ext;
	}
//	if (i)		_export_replace_fname[fname+str_rep("_", i-1)+ext] = test_fname;
	_export_fnames_array.push(test_fname);
	_title2fn[orig_title] = test_fname;
	if (!create_mode)
		return escape(test_fname);
	return test_fname;
}

woas["export_wiki"] = function () {
	try {
		var xhtml_path = $("woas_ep_xhtml").value;
		var img_path = $("woas_ep_img").value;
		var js_mode = 0;
		if ($("woas_cb_js_dyn").checked)
			js_mode = 1;
		else if ($("woas_cb_js_exp").checked)
			js_mode = 2;
		var sep_css = $("woas_cb_sep_css").checked,
			exp_menus = $("woas_cb_export_menu").checked;
		_export_main_index = $("woas_cb_index_main").checked;
		_export_default_ext = $("woas_ep_ext").value;
		var meta_author = $("woas_ep_author").value;
		meta_author = this.trim(meta_author);
		if (meta_author.length)
			meta_author = '<meta name="author" content="'+this._attrib_escape(this.xhtml_encode(meta_author))+'" />'+"\n";
		_export_unix_norm = $("woas_cb_unix_norm").checked;
	} catch (e) { alert(e); return false; }
	
	$.show("loading_overlay");
	$("loading_overlay").focus();
	var css = _css_obj().innerHTML;
	// reset some export globals
	_export_fnames_array = [];
	_title2fn = {};
	if (sep_css) {
		var css_path = "woas.css";
		_export_fnames_array.push(css_path);
		saveFile(xhtml_path+css_path, css);
		css = '<link rel="stylesheet" type="text/css" media="all" href="'+css_path+'" />';
	} else
		css = '<style type="text/css">'+css+'</style>';
	
	var custom_bs = "";
	if (js_mode==2) {
		data = this.(page_titles.indexOf("Special::Bootscript"));
		if (data!=null && data.length) {
			saveFile(xhtml_path+"bootscript.js", data);
			custom_bs = '<sc'+'ript type="text/javascript" src="bootscript.js"></sc'+'ript>';
		}
	}

	var l=page_titles.length, data = null, fname = "", done=0, wt=null;
	for (var pi=0;pi<l;pi++) {
		if (page_titles[pi].match(/^Special::/)) continue;
		data = this.export_get_page(pi);
		if (data == null) continue;
		if (page_titles[pi].indexOf("::Menu")==page_titles[pi].length-6) continue;
		fname = this._export_get_fname(page_titles[pi], true);
		if (this.is__embedded(pi)) {
			if (this.is__image(pi)) {
				if (!this._b64_export(data, img_path+fname))
					break;
				else { ++done; continue; }
			} else
				data = '<pre class="wiki_preformatted">'+this.xhtml_encode(data)+"</pre>";
		} else {
			data = this.parser.parse(data, true, js_mode);
			if (js_mode) {
				wt = $("wiki_text");
				wt.innerHTML = data;
				this._activate_scripts();
				data = wt.innerHTML;
			}			
		}
		// convert UTF8 sequences of the XHTML source into &#dddd; sequences
		data = this.utf8_encode(data);
		// prepare the raw text for later description/keywords generation
		var raw_text = this.trim(this.xhtml_to_text(data));
		if (exp_menus) {
			var _exp_menu = this.get_text("::Menu");
			if (_exp_menu == null)
				_exp_menu = "";
			var _ns = this.get_namespace(page_titles[pi]);
			if (_ns.length) {
				var mpi = page_titles.indexOf(_ns+"::Menu");
				if (mpi != -1) {
					var tmp=this.export_get_page(mpi);
					if (tmp!=null)
						_exp_menu += tmp;
				}
			}
			if (_exp_menu.length) {
				_exp_menu = this.parser.parse(_exp_menu, true, js_mode);
				if (js_mode)
					this._activate_scripts();
				// fix also the encoding in the menus
				_exp_menu = this.utf8_encode(_exp_menu);
			}
			data = '<div class="menu_area" id="sw_menu_area" style="position: fixed;"><div class="wiki" id="menu_area">'+_exp_menu+'</div></div><div class="text_area" id="wiki_text">'+data+'</div>';
		}
		data = "<ht"+"ml><he"+"ad><title>"+this.xhtml_encode(page_titles[pi])+"</title>"+css+
		'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+"\n"+
		'<meta name="generator" content="Wiki on a Stick v'+this.version+'" />'+"\n"+
		'<meta name="keywords" content="'+this._attrib_escape(_auto_keywords(raw_text))+'" />'+"\n"+
		'<meta name="description" content="'+
		this._attrib_escape(raw_text.replace(/\s+/g, " ").substr(0,max_description_length))+'" />'+"\n"+
		meta_author+
		custom_bs+
		"</h"+"ead><"+"body>"+data+"</bod"+"y></h"+"tml>\n"; raw_text = null;
		if (!saveFile(xhtml_path+fname, _doctype+data))
			break;
		++done;
	}
	if (js_mode) {
		this.refresh_menu_area();
		this.set_current(current);
	}
	$.hide("loading_overlay");
	alert(done+" pages exported successfully");
	return true;
}
