
var _export_main_index = false, _export_unix_norm = false,
	_export_default_ext;

var _title2fn;

var _export_fnames_array = [];

var _further_pages = [];

woas["_attrib_escape"] = function(s) {
	return s.replace(/"/g, '&quot;');
}

woas["_export_get_fname"] = function (title, create_mode) {
	if (typeof(_title2fn[title]) != 'undefined') {
		// return a cached title
		if (!create_mode)
			return escape(_title2fn[title]);
		return _title2fn[title];
	}
	var orig_title = title;
	// handle the valid exportable secial pages
	var sp;
	if (title.match(/::$/))
		sp = true;
	else if (this.is_reserved(title)) {
		if (title.match(/^Special::/)) {
			if (this.page_index(title)==-1)
				sp = true;
			else {
				_title2fn[title] = "#";
				return "#";
			}
		} else {
			_title2fn[title] = "#";
			return "#";
		}
	}
	if (sp) {
		// save a reference to this namespace or reserved page
		if (_further_pages.indexOf(title)==-1)
			_further_pages.push(title);
	} else {
		var pi=this.page_index(title);
		if (pi==-1) {
			alert("Page does not exist: "+title);
			_title2fn[title] = "#";
			return "#";
		}
		// beware: a special page or namespace index page cannot be main page considering the below code
		if (_export_main_index && (title==main_page)) {
			_title2fn[title] = "index."+_export_default_ext;
			_export_fnames_array.push(_title2fn[title]);
			return _title2fn[title];
		}
	}
	var ext = "";
	if (!sp && this.is__embedded(pi)) {
		title = title.substr(title.indexOf("::")+2);
		if (!this.is__image(pi))
			ext = "."+_export_default_ext;
//		emb = true;
	} else {
		ext = "."+_export_default_ext;
//		emb = false;
	}
	var fname = title
	// convert UTF8 characters to something else (cross-browser safe cheap solution)
	.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length, r="";
		for(var i=0;i<l;i++) {
			switch ($1[i]) {
				// TODO: add most common diacritics
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
		return "_".repeat($1.length);
	});
	
	if (_export_unix_norm)
		fname = fname.toLowerCase().replace(/\s+/g, "_").replace(/::/g, "-");
	else
		fname = fname.replace(/::/g, " - ");
	var test_fname = fname+ext, i=0;
	while (_export_fnames_array.indexOf(test_fname)!=-1) {
		log(test_fname+" already created, checking next fname");	// log:1
		test_fname = fname+"_".repeat(++i)+ext;
	}
//	if (i)		_export_replace_fname[fname+"_".repeat(i-1)+ext] = test_fname;
	_export_fnames_array.push(test_fname);
	_title2fn[orig_title] = test_fname;
	if (!create_mode)
		return escape(test_fname);
	return test_fname;
}

woas["export_parse"] = function (data, js_mode) {
	// a normal wiki page, parse it and eventually execute the attached javascript
	data = this.parser.parse(data, true, js_mode);
	if (js_mode) {
		wt = $("wiki_text");
		wt.innerHTML = data;
		this._activate_scripts();
		data = wt.innerHTML;
	}
	return data;
}

woas["export_one_page"] = function (
		data, title, fname, exp) {
	// convert UTF8 sequences of the XHTML source into &#dddd; sequences
	data = this.utf8_encode(data);
	// prepare the raw text for later description/keywords generation
	var raw_text = this.trim(this.xhtml_to_text(data));
	if (exp.exp_menus) {
		var _exp_menu = this.get_text("::Menu");
		if (_exp_menu == null)
			_exp_menu = "";
		var _ns = this.get_namespace(title);
			if (_ns.length) {
				var mpi = this.page_index(_ns+"::Menu");
				if (mpi != -1) {
					var tmp=this.get_text_special(ns+"::Menu");
					if (tmp!=null)
						_exp_menu += tmp;
				}
			}
			if (_exp_menu.length) {
				_exp_menu = this.parser.parse(_exp_menu, true, exp.js_mode);
				if (exp.js_mode)
					this._activate_scripts();
				// fix also the encoding in the menus
				_exp_menu = this.utf8_encode(_exp_menu);
			}
			data = '<div class="menu_area" id="sw_menu_area" style="position: fixed;"><div class="wiki" id="menu_area">'+_exp_menu+'</div></div><div class="text_area" id="wiki_text">'+data+'</div>';
		}
		data = "<ht"+"ml><he"+"ad><title>"+this.xhtml_encode(title)+"</title>"+exp.css+
		'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+"\n"+
		'<meta name="generator" content="Wiki on a Stick v'+this.version+'" />'+"\n"+
		'<meta name="keywords" content="'+this.utf8_encode(this._attrib_escape(_auto_keywords(raw_text)))+'" />'+"\n"+
		'<meta name="description" content="'+
		this.utf8_encode(this._attrib_escape(raw_text.replace(/\s+/g, " ").substr(0,max_description_length)))+'" />'+"\n"+
		exp.meta_author+
		exp.custom_bs+
		"</h"+"ead><"+"body>"+data+"</bod"+"y></h"+"tml>\n"; raw_text = null;
	return saveFile(exp.xhtml_path+fname, _doctype+data);
}

woas["export_wiki"] = function () {
	// export settings object
	var exp = {};
	try {
		exp["xhtml_path"] = $("woas_ep_xhtml").value;
		var img_path = $("woas_ep_img").value;
		exp["js_mode"] = 0;
		if ($("woas_cb_js_dyn").checked)
			exp.js_mode = 1;
		else if ($("woas_cb_js_exp").checked)
			exp.js_mode = 2;
		var sep_css = $("woas_cb_sep_css").checked;
		exp["exp_menus"] = $("woas_cb_export_menu").checked;
		_export_main_index = $("woas_cb_index_main").checked;
		_export_default_ext = $("woas_ep_ext").value;
		exp["meta_author"] = this.trim($("woas_ep_author").value);
		if (exp.meta_author.length)
			exp.meta_author = '<meta name="author" content="'+this._attrib_escape(this.xhtml_encode(exp.meta_author))+'" />'+"\n";
		_export_unix_norm = $("woas_cb_unix_norm").checked;
	} catch (e) { alert(e); return false; }
	
	$.show("loading_overlay");
	$("loading_overlay").focus();
	exp["css"] = _css_obj().innerHTML;
	// reset export globals - remember that arrays are object and cannot be initialized in 1 line
	_export_fnames_array = [];
	_title2fn = {};
	if (sep_css) {
		var css_path = "woas.css";
		_export_fnames_array.push(css_path);
		saveFile(exp.xhtml_path+css_path, exp.css);
		exp.css = '<link rel="stylesheet" type="text/css" media="all" href="'+css_path+'" />';
	} else
		exp.css = '<style type="text/css">'+exp.css+'</style>';
	exp["custom_bs"] = "";
	if (exp.js_mode==2) {
		data = pages[this.page_index("WoaS::Bootscript")];
		if (data!=null && data.length) {
			saveFile(exp.xhtml_path+"bootscript.js", data);
			exp.custom_bs = '<sc'+'ript type="text/javascript" src="bootscript.js"></sc'+'ript>';
		}
	}

	var l=page_titles.length, data = null, fname = "", done=0, wt=null;
	for (var pi=0;pi<l;pi++) {
		// do skip physical special pages
		if (page_titles[pi].match(/^Special::/)) continue;
		// do skip menu pages (they are included in each page)
		if (page_titles[pi].indexOf("::Menu")==page_titles[pi].length-6) continue;
		data = this.get_text_special(page_titles[pi]);
		if (data == null) continue;
		fname = this._export_get_fname(page_titles[pi], true);
		if (this.is__embedded(pi)) {
			if (this.is__image(pi)) {
				if (!this._b64_export(data, img_path+fname))
					break;
				// image export was successful, continue to next page
				else { ++done; continue; }
			} else
				// show the embedded files inline
				data = '<pre class="wiki_preformatted">'+this.xhtml_encode(data)+"</pre>";
		} else
			data = this.export_parse(data, exp.js_mode);
		if (!this.export_one_page(data, page_titles[pi], fname, exp))
			break;
		++done;
	}
	log("pages yet to process: "+_further_pages);	// log:1
	// process further pages
	var title;
	// exchange arrays to parse at some extent
	var eatable = _further_pages.slice(0);
	while (eatable.length) {
		_further_pages = [];
		for(var i=0;i<eatable.length;i++) {
			title = eatable[i];
			data = this.get_text_special(title);
			if (data===null) {
				log("cannot process "+title);
				continue;
			}
			// TODO: allow special pages to have extended attributes
			data = this.export_parse(data, exp.js_mode);
			if (this.export_one_page(data, title, _title2fn[title], exp))
				++done;
		}
		eatable = _further_pages.slice(0);
	}
//	_further_pages = [];
	if (exp.js_mode) {
		this.refresh_menu_area();
		this.set_current(current, false);
	}
	$.hide("loading_overlay");
	alert(done+" pages exported successfully");
	return true;
}
