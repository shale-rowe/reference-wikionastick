// WoaS 'exporter' module
woas.exporter = {
	//TODO: populate it
};

var _export_main_index = false, _export_unix_norm = false,
	_export_default_ext;

var _title2fn;

var _export_fnames_array = [];

var _further_pages = [];

woas._unix_normalize = function(s) {
	return s.toLowerCase().replace(/\s+/g, "_").replace(/::/g, "-")
};

// save a base64 data: stream into an external file
woas._b64_export = function(data, dest_path) {
	// decode the base64-encoded data
	data = decode64(data.replace(/^data:\s*[^;]*;\s*base64,\s*/, ''));
	// attempt to save the file
	return this.save_file(dest_path, this.file_mode.BINARY, data);
};

woas._attrib_escape = function(s) {
	return s.replace(/"/g, '&quot;');
};

woas._export_get_fname = function (title, create_mode) {
	if (typeof(_title2fn[title]) != 'undefined') {
		// return a cached title
		if (!create_mode) {
			// do not escape the null-page URL
			if (_title2fn[title] == '#')
				return '#';
			return escape(_title2fn[title]);
		}
		return _title2fn[title];
	}
	var sp, orig_title = title;
	// handle the valid exportable special pages
	if (title.match(/::$/))
		sp = true;
	else if (this.is_reserved(title)) {
		var nogo;
		if (title.match(/^WoaS::/))
			nogo = (this.unexportable_pages2.indexOf(title)!==-1);
		else if (title.match(/^Special::/))
			nogo = (this.unexportable_pages.indexOf(title.substr(9)) !== -1);
		else // other reserved pages, deny
			nogo = true;
		if (nogo) {
			log("Reserved page will not be exported: "+title);
			_title2fn[title] = "#";
			return "#";
		}
	}
	var pi;
	if (sp) {
		// save a reference to this namespace or reserved page
		if (_further_pages.indexOf(title)==-1)
			_further_pages.push(title);
	} else {
		pi=this.page_index(title);
		if (pi===-1) {
			this.alert(this.i18n.PAGE_NOT_EXISTS+title);
			_title2fn[title] = "#";
			return "#";
		}
		// beware: a special page or namespace index page cannot be main page
		// considering the below code
		if (_export_main_index && (title==this.config.main_page)) {
			_title2fn[title] = "index."+_export_default_ext;
			_export_fnames_array.push(_title2fn[title]);
			return _title2fn[title];
		}
	}
	var ext = "";
	if (!sp && this.is__embedded(pi)) {
		title = title.substr(title.indexOf("::")+2);
//		if (!this.is__image(pi))
//			ext = "."+_export_default_ext;
//		emb = true;
	} else {
		ext = "."+_export_default_ext;
//		emb = false;
	}
	var fname = title
	// convert UTF8 characters to something else (cross-browser safe cheap solution)
	.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length, r="";
		for(var i=0;i < l;i++) {
			/*switch ($1[i]) {
				// TODO: add most common diacritics
				case "\u00e2":
					r+="a";
					break;
				default:
					r+="_";
			}*/
			// until that day ...
			r += ($1[i] == "\u00e2") ? "a" : "_";
		}
		return r;
	})
	// escape some path-unsafe characters
	.replace(/[:\\\/<>?#=!]+/g, function($1) {
		return "_".repeat($1.length);
	});
	// fix the directory separator chars
	if (_export_unix_norm)
		fname = this._unix_normalize(fname);
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
};

woas.export_parse = function (data, js_mode) {
	// a normal wiki page, parse it and eventually execute the attached javascript
	data = this.parser.parse(data, true, js_mode);
	if (js_mode) {
		wt = $("wiki_text");
		wt.innerHTML = data;
		this._activate_scripts();
		data = wt.innerHTML;
	}
	return data;
};

woas.export_one_page = function (data, title, fname, exp, mts) {
	data = this.utf8_encode(data);
	// prepare the raw text for later description/keywords generation
	var raw_text = this.trim(this.xhtml_to_text(data));
	if (exp.exp_menus) {
		var _exp_menu = this.get_text("::Menu");
		if (_exp_menu === null)
			_exp_menu = "";
		var _ns = this.get_namespace(title);
			if (_ns.length) {
				var mpi = this.page_index(_ns+"::Menu");
				if (mpi != -1) {
					var tmp=this.get_text_special(_ns+"::Menu");
					if (tmp!==null)
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
			data = '<'+'div class="menu_area" id="sw_menu_area" style="position: absolute;"><'+'div class="wiki" id="menu_area">'+_exp_menu+'<'+'/div><'+'/div><'+'div class="woas_text_area" id="wiki_text">'+data+'<'+'/div>';
		}
		// craft a nice XHTML page
		data = "<"+"title>"+this.xhtml_encode(title)+"<"+"/title>"+
				// add the exported CSS
				exp.css+
				// add the last-modified header
				(mts ? '<'+'meta http-equiv="last-modified" content="'+
				(new Date(mts*1000)).toGMTString()+'" />'+"\n" : '')+
				// other useful META stuff
		'<'+'meta name="generator" content="Wiki on a Stick v'+this.version+' - http://stickwiki.sf.net/" />'+"\n"+
		'<'+'meta name="keywords" content="'+this.utf8_encode(this._attrib_escape(_auto_keywords(raw_text)))+'" />'+"\n"+
		'<'+'meta name="description" content="'+
		this.utf8_encode(this._attrib_escape(raw_text.replace(/\s+/g, " ").substr(0,max_description_length)))+'" />'+"\n"+
		exp.meta_author+
		exp.custom_scripts+
		"<'+'/head><"+"body>"+data+
		(mts ? "<"+"div class=\"woas_page_mts\">"+this.last_modified(mts)+"<"+"/div>" : "")+
		"<"+"/body><"+"/html>\n"; raw_text = null;
	return this.save_file(exp.xhtml_path+fname, this.file_mode.ASCII, woas.DOCTYPE+woas.DOC_START+data);
};

woas.export_wiki = function () {
	var exp = {}; // export settings object
	var css_path, sep_css, img_path;
	try {
		exp.xhtml_path = $("woas_ep_xhtml").value;
		img_path = $("woas_ep_img").value;
		exp.js_mode = 0;
		if ($("woas_cb_js_dyn").checked)
			exp.js_mode = 1;
		else if ($("woas_cb_js_exp").checked)
			exp.js_mode = 2;
		sep_css = $("woas_cb_sep_css").checked;
		exp.exp_menus = $("woas_cb_export_menu").checked;
		_export_main_index = $("woas_cb_index_main").checked;
		_export_default_ext = $("woas_ep_ext").value;
		exp.meta_author = this.trim($("woas_ep_author").value);
		if (exp.meta_author.length)
			exp.meta_author = '<'+'meta name="author" content="'+this._attrib_escape(this.xhtml_encode(exp.meta_author))+'" />'+"\n";
		_export_unix_norm = $("woas_cb_unix_norm").checked;
	} catch (e) { this.crash(e); return false; }
	
	this.progress_init("Exporting XHTML");
	exp.css = this.css.get();
	// add some other CSS which is not used by live WoaS
	exp.css += "\n.broken_link { color: red; font-decoration: strike-through;}\n";
	// reset export globals - remember that arrays are object and cannot be initialized in 1 line
	_export_fnames_array = [];
	_title2fn = {};
	if (sep_css) {
		css_path = "woas.css";
		_export_fnames_array.push(css_path);
		this.save_file(exp.xhtml_path+css_path, this.file_mode.ASCII, exp.css);
		exp.css = "<"+"link rel=\"stylesheet\" type=\"text/css\" media=\"all\" href=\""+css_path+"\" /"+">";
	} else
		exp.css = "<"+"style type=\"text/css\">"+exp.css+"<"+"/style>";
	exp.custom_scripts = "";
	var data;
	if (exp.js_mode==2) {
		//export all active plugins as javascript code
		var js_fn;
		for(var pi=0,pt=this.plugins._active.length;pi<pt;++pi) {
			data = this.plugins.get(this.plugins._active[pi]);
			if (this.plugins.is_external) {
				// data is an array of sources, go through it
				for(var i=0;i<data.length;++i) {
					exp.custom_scripts += '<'+'sc'+'ript type="text/javascript" src="'+data[i]+'"><'+"/script>\n";
				}
			} else {
				js_fn = this._unix_normalize(this.plugins._active[pi])+".js";
				if (this.save_file(exp.xhtml_path+js_fn,
									this.file_mode.ASCII, data)) {
					exp.custom_scripts += '<'+'script type="text/javascript" src="'+js_fn+'"><'+"/script>\n";
				}
			}
		}
	}

	var l = page_titles.length, fname = "", done = 0, total = 0, mnupos;
	data = null;
	for (var pi=0;pi < l;pi++) {
		// do skip physical special pages
		if (page_titles[pi].match(/^Special::/)) continue;
		if (this.static_pages2.indexOf(page_titles[pi]) !== -1) continue;
		// skip also the unexportable WoaS pages
		if (this.unexportable_pages2.indexOf(page_titles[pi]) !== -1) continue;
		// do skip menu pages (they are included in each page)
		mnupos = page_titles[pi].indexOf("::Menu");
		if ((mnupos != -1) &&
			(mnupos==page_titles[pi].length-6)) continue;
		data = this.get_text_special(page_titles[pi]);
		// skip pages which could not be decrypted
		if (data === null) continue;
		fname = this._export_get_fname(page_titles[pi], true);
		// will skip WoaS::Plugins::* and WoaS::Aliases
		if (fname === '#') {
//			log("skipping "+page_titles[pi]);
			continue;
		}
		++total;
		if (this.is__embedded(pi)) {
			if (this.is__image(pi)) {
				if (!this._b64_export(data, img_path+fname))
					break;
				// image export was successful, continue to next page
				else { ++done; continue; }
			} else {
				// fully export the file
				if (!this._b64_export(data, exp.xhtml_path+fname))
					break;
				// image export was successful, continue to next page
				else { ++done; continue; }
			}
		} else
			data = this.export_parse(data, exp.js_mode);
		if (!this.export_one_page(data, page_titles[pi], fname, exp, this.config.store_mts ? page_mts[pi] : 0))
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
		for(var i=0,el=eatable.length;i < el;i++) {
			title = eatable[i];
			data = this.get_text_special(title);
			if (data===null) {
				log("cannot process "+title);
				continue;
			}
			// TODO: allow special pages to have extended attributes
			data = this.export_parse(data, exp.js_mode);
			++total;
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
	this.progress_finish();
	this.alert(this.i18n.EXPORT_OK.sprintf(done, total));
	return true;
};

var max_keywords_length = 250;
var max_description_length = 250;
// proper autokeywords generation functions begin here
var reKeywords = new RegExp("[^\\s\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{2,}", "g");
function _auto_keywords(source) {
	if (!source.length) return "";
	var words = source.match(reKeywords);
	if (!words.length) return "";
	var nu_words = new Array();
	var density = new Array();
	var wp=0;
	for(var i=0;i < words.length;i++) {
		if (words[i].length==0)
			continue;
		cond = (woas.i18n.common_words.indexOf(words[i].toLowerCase())<0);
		if (cond) {
			wp = nu_words.indexOf(words[i]);
			if (wp < 0) {
				nu_words = nu_words.concat(new Array(words[i]));
				density[nu_words.length-1] = {"i":nu_words.length-1, "w":1};
			} else
				density[wp].w = density[wp].w + 1;
		}
	}
	if (!density.length) return "";
	words = new Array();
	var keywords = "", nw = "";
	density = density.sort(function(a,b){return b.w - a.w;});
	var ol=0;
	for(i=0;i < density.length;i++) {
		nw = nu_words[density[i].i];
		if (ol+nw.length>max_keywords_length)
			break;
		keywords = keywords+","+nw;
		ol+=nw.length;
	}
	return keywords.substr(1);
}


// used to export files/images
woas.export_file = function(page, dest_path) {
	var pi=this.page_index(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	// attempt to save the file (binary mode)
	return this.save_file(dest_path, this.file_mode.BINARY, decode64(data));
};

// export a base64-encoded image to a file
woas.export_image = function(page, dest_path) {
	var pi=this.page_index(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	return this._b64_export(data, dest_path);
};
