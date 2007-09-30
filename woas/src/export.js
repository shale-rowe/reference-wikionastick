
woas["export_get_page"] = function(pi) {
	if (!this.is__encrypted(pi))
		return pages[pi];
	if (!key.length) {
		latest_AES_page = "";
		return null;
	}
	var pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
	last_AES_page = page_titles[pi];
	return pg;	
}

var _export_main_index = false, _export_unix_norm = false,
	_export_create_mode = false, _export_default_ext;

var _export_fnames_array = [], _export_replace_fname = {};

woas["_export_get_fname"] = function (title) {
	if (title.match(/::$/)) {
		return "#";
	}
	if (this.is_reserved(title))
		return "#";
	var pi=page_titles.indexOf(title);
	if (pi==-1) {
		alert("Page does not exist: "+title);
		return "#";
	}
	if (_export_main_index && (title==main_page))
		return "index."+_export_default_ext;
	var ext = "";
	if (this.is__embedded(pi)) {
		title = title.substr(title.indexOf("::")+2);
		if (!this.is__image(pi))
			ext = "."+_export_default_ext;
	} else ext = "."+_export_default_ext;
	var fname;
	if (_export_unix_norm)
		fname = escape(title.toLowerCase().replace(/\s+/g, "_")).replace(/%3A%3A/g, "-");
	else
		fname = escape(title).replace(/%20/g, " ").replace(/%3A%3A/g, " - ");
	if (!_export_create_mode) {
		if (_export_replace_fname[fname+ext]!=null)
			return _export_replace_fname[fname+ext];
		return fname+ext;
	}
	var test_fname = fname+ext, i=0;
	while (_export_fnames_array.indexOf(test_fname)!=-1) {
		log(test_fname+" already exists, checking next fname");
		test_fname = fname+str_rep("_", ++i)+ext;
	}
	if (i)
		_export_replace_fname[fname+str_rep("_", i-1)+ext] = test_fname;
	_export_fnames_array.push(test_fname);
	return test_fname;
}


// by legolas558
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
			meta_author = '<meta name="author" content="'+this.xhtml_encode(meta_author)+'" />'+"\n";
		_export_unix_norm = $("woas_cb_unix_norm").checked;
	} catch (e) { alert(e); return false; }
	
	$.show("loading_overlay");
	$("loading_overlay").focus();
	var css = _css_obj().innerHTML;
	// reset some export globals
	_export_fnames_array = [];
	_export_replace_fname = {}
	if (sep_css) {
		var css_path = "woas.css";
		_export_fnames_array.push(css_path);
		saveFile(xhtml_path+css_path, css);
		css = '<link rel="stylesheet" type="text/css" media="all" href="'+css_path+'" />';
	} else
		css = '<style type="text/css">'+css+'</style>';
	
	var custom_bs = "";
	if (js_mode==2) {
		data = this.export_get_page(page_titles.indexOf("Special::Bootscript"));
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
		_export_create_mode = true;
		fname = this._export_get_fname(page_titles[pi]);
		_export_create_mode = false;
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
			}
			data = '<div class="menu_area" id="sw_menu_area" style="position: fixed;"><div class="wiki" id="menu_area">'+_exp_menu+'</div></div><div class="text_area" id="wiki_text">'+data+'</div>';
		}
		data = "<ht"+"ml><he"+"ad><title>"+this.xhtml_encode(page_titles[pi])+"</title>"+css+
		'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+"\n"+
		'<meta name="generator" content="Wiki on a Stick v'+this.version+'" />'+"\n"+
		'<meta name="keywords" content="'+_auto_keywords(raw_text)+'" />'+"\n"+
		'<meta name="description" content="'+
		raw_text.replace(/\s+/g, " ").substr(0,max_description_length)+'" />'+"\n"+
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
