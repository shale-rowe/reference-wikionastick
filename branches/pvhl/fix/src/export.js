// WoaS 'exporter' module
woas.exporter = {
	_unix_norm: false,
	_default_ext: 'html',

	// arrays/objects using during export
	_title2fn: {},
	_further_pages: [],
	_export_fnames_array: [],
	_settings: {},
	
	clear: function() {
		this._export_fnames_array = [];
		this._title2fn = {};
		this._further_pages = [];
		this._settings = {};
	},
	
	// export wiki in XHTML/CSS and attachment files
	do_export: function () {
		this._settings.custom_scripts = "";
		var data;
		if (this._settings.js_mode==2) {
			//export all active plugins as javascript code
			var js_fn;
			for(var pi=0,pt=woas.plugins._active.length;pi<pt;++pi) {
				data = woas.plugins.get(woas.plugins._active[pi]);
				if (woas.plugins.is_external) {
					// data is an array of sources, go through it
					for(var i=0;i<data.length;++i) {
						this._settings.custom_scripts += '<'+'sc'+'ript type="text/javascript" src="'+data[i]+'"><'+"/script>\n";
					}
				} else {
					js_fn = woas._unix_normalize(woas.plugins._active[pi])+".js";
					if (woas.save_file(this._settings.xhtml_path+js_fn,
										woas.file_mode.ASCII_TEXT, data)) {
						this._settings.custom_scripts += '<'+'script type="text/javascript" src="'+js_fn+'"><'+"/script>\n";
					}
				}
			}
		}

		var pg, pi, l, fname = "", done = 0, total = 0, mnupos;
		data = null;
		for (pi = 0, l = page_titles.length; pi < l; pi++) {
			pg = page_titles[pi];
			// do skip physical special pages
			if (pg.match(/^Special::/)) continue;
			if (woas.static_pages2.indexOf(pg) !== -1) continue;
			// skip also the unexportable WoaS pages
			if (woas.unexportable_pages2.indexOf(pg) !== -1) continue;
			// do skip menu pages (they are already included in each page)
			if (pg.substr(-6) === '::Menu' && pg !== 'WoaS::Help::Menu') {
				continue;
			}
			data = woas.get_text_special(pg);
			// skip pages which could not be decrypted
			if (data === null) continue;
			fname = this._get_fname(pg, true);
			// will skip WoaS::Plugins::* and WoaS::Aliases
			if (fname === '#') {
	//			woas.log("skipping "+pg);
				continue;
			}
			++total;
			if (woas.is__embedded(pi)) {
				if (woas.is__image(pi)) {
					if (!woas._b64_export(data, this._settings.img_path+fname))
						break;
					// image export was successful, continue to next page
					else { ++done; continue; }
				} else {
					// fully export the file
					if (!woas._b64_export(data, this._settings.xhtml_path+fname))
						break;
					// image export was successful, continue to next page
					else { ++done; continue; }
				}
			} else
				data = woas.export_parse(data, this._settings.js_mode);
			if (!this._one_page(data, pg, fname, woas.config.store_mts ? page_mts[pi] : 0))
				break;
			++done;
		}
		woas.log("pages yet to process: "+this._further_pages);	// log:1
		// process further pages
		var title;
		// exchange arrays to parse at some extent
		var eatable = this._further_pages.slice(0);
		while (eatable.length) {
			this._further_pages = [];
			for(var i=0,el=eatable.length;i < el;i++) {
				title = eatable[i];
				data = woas.get_text_special(title);
				if (data===null) {
					woas.log("cannot process "+title);
					continue;
				}
				// TODO: allow special pages to have extended attributes
				data = woas.export_parse(data, this._settings.js_mode);
				++total;
				if (this._one_page(data, title, this._title2fn[title]))
					++done;
			}
			eatable = this._further_pages.slice(0);
		}
		// return total exported pages/objects
		return [done, total];
	},
	
	_one_page: function (data, title, fname, mts) {
		data = woas.utf8.do_escape(data);
		// prepare the raw text for later description/keywords generation
		var raw_text = woas.trim(woas.xhtml_to_text(data)),
			exp_menu, ns, mpi, tmp;
		if (this._settings.exp_menus) {
			ns = woas.get_namespace(title);
			// get submenu, if available, from first available namespace
			while (ns !== "") {
				mpi = woas.page_index(ns + "::Menu");
				if (mpi !== -1) {
					tmp = woas.get__text(mpi);
					if (tmp !== null)
						exp_menu = tmp;
					break;
				}
				tmp = ns.lastIndexOf("::");
				ns = tmp === -1 ? "" : ns.substring(0, tmp);
			}
			if (!ns) {
				exp_menu = woas.get_text("::Menu") || "";
			}
			// parse the exported menu
			if (exp_menu) {
				exp_menu = woas.parser.parse(exp_menu, true, this._settings.js_mode);
				if (this._settings.js_mode)
					woas.scripting.activate("menu");
				// fix also the encoding in the menus
				exp_menu = woas.utf8.do_escape(exp_menu);
			}
			//TODO: use correct ids/class names
			data = '<'+'div id="i_woas_menu_wrap" style="position: absolute;"><'+'div class="woas_wiki" id="woas_menu">'+exp_menu+'<'+'/div><'+
					'/div><'+'div class="woas_text_area" id="woas_page">'+data+'<'+'/div>';
		}
		// craft a nice XHTML page
		data = "<"+"title>"+woas.xhtml_encode(title)+"<"+"/title>"+
				// add the exported CSS
				this._settings.css+
				// add the last-modified header
				(mts ? '<'+'meta http-equiv="last-modified" content="'+
				(new Date(mts*1000)).toGMTString()+'" />'+"\n" : '')+
				// other useful META stuff
				'<'+'meta name="generator" content="Wiki on a Stick v'+woas.version+' - http://stickwiki.sf.net/" />'+"\n"+
				'<'+'meta name="keywords" content="'+
				woas.utf8.do_escape(woas._attrib_escape(_auto_keywords(raw_text)))+'" />'+"\n"+
				'<'+'meta name="description" content="'+
				woas.utf8.do_escape(woas._attrib_escape(raw_text.replace(/\s+/g, " ")
				.substr(0,max_description_length)))+'" />'+"\n"+
				this._settings.meta_author+this._settings.custom_scripts+
				'<'+'/head><'+'body>'+data+
				(mts ? "<"+"div id=\"woas_page_mts\">"+woas.last_modified(mts)+
				"<"+"/div>" : "")+"<"+"/body><"+"/html>\n"; raw_text = null;
		return woas.save_file(this._settings.xhtml_path+
			fname, woas.file_mode.ASCII_TEXT, woas.DOCTYPE+woas.DOC_START+data);
	},
	
	_get_fname: function (title, create_mode) {
		if (typeof(this._title2fn[title]) != 'undefined') {
			// return a cached title
			if (!create_mode) {
				// do not escape the null-page URL
				if (this._title2fn[title] == '#')
					return '#';
				return escape(this._title2fn[title]);
			}
			return this._title2fn[title];
		}
		var sp, orig_title = title;
		// handle the valid exportable special pages
		if (title.match(/::$/)) {
			sp = true;
		} else if (woas.is_reserved(title)) {
			var nogo;
			if (title.match(/^WoaS::/))
				nogo = (woas.unexportable_pages2.indexOf(title)!==-1);
			else if (title.match(/^Special::/))
				nogo = (woas.unexportable_pages.indexOf(title.substr(9)) !== -1);
			else // other reserved pages, deny
				nogo = true;
			if (nogo) {
				woas.log("Reserved page will not be exported: "+title);
				this._title2fn[title] = "#";
				return "#";
			} else // do export these special pages later
				// PVHL: but don't rewrite actual help pages
				if (!title.match("WoaS::Help")) sp = true;
		}
		var pi;
		if (sp) {
			// save a reference to this namespace or reserved page
			if (this._further_pages.indexOf(title)==-1)
				this._further_pages.push(title);
		} else {
			pi=woas.page_index(title);
			if (pi === -1) {
				woas.alert(woas.i18n.PAGE_NOT_EXISTS.sprintf(title));
				this._title2fn[title] = "#";
				return "#";
			}
			// beware: a special page or namespace index page cannot be main page
			// considering the below code
			if (this._settings._main_index && (title === woas.config.main_page)) {
				this._title2fn[title] = "index."+ this._default_ext;
				this._export_fnames_array.push(this._title2fn[title]);
				return this._title2fn[title];
			}
		}
		var ext = "";
		if (!sp && woas.is__embedded(pi)) {
			// remove the namespace
			title = title.substr(title.indexOf("::")+2);
	//		if (!this.is__image(pi))
	//			ext = "."+this._default_ext;
	//		emb = true;
		} else {
			ext = "."+this._default_ext;
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
		if (this._settings._unix_norm)
			fname = woas._unix_normalize(fname);
		else
			fname = fname.replace(/::/g, " - ");
		var test_fname = fname+ext, i=0;
		while (this._export_fnames_array.indexOf(test_fname) !== -1) {
			woas.log(test_fname+" already created, checking next fname");	// log:1
			test_fname = fname+"_".repeat(++i)+ext;
		}
	//	if (i)		_export_replace_fname[fname+"_".repeat(i-1)+ext] = test_fname;
		this._export_fnames_array.push(test_fname);
		this._title2fn[orig_title] = test_fname;
		if (!create_mode)
			return escape(test_fname);
		return test_fname;
	}

};

woas._unix_normalize = function(s) {
	return s.toLowerCase().replace(/\s+/g, "_").replace(/::/g, "-")
};

// save a base64 data: stream into an external file
woas._b64_export = function(data, dest_path) {
	// decode the base64-encoded data
	data = this.base64.decode(data.replace(/^data:\s*[^;]*;\s*base64,\s*/, ''));
	// attempt to save the file
	return this.save_file(dest_path, this.file_mode.BINARY, data);
};

woas._attrib_escape = function(s) {
	return s.replace(/"/g, '&quot;');
};

woas.export_parse = function (data, js_mode) {
	// a normal wiki page, parse it and eventually execute the attached javascript
	data = this.parser.parse(data, true, js_mode);
	if (js_mode) {
		this.setHTMLDiv(d$("woas_page"), data);
		this.scripting.activate("page");
		data = this.getHTMLDiv(d$("woas_page"));
	}
	return data;
};

woas.export_wiki = function() {
	var sep_css;
	// parse user export options
	try {
		this.exporter._settings.xhtml_path = d$("woas_ep_xhtml").value;
		this.exporter._settings.img_path = d$("woas_ep_img").value;
		this.exporter._settings.js_mode = 0;
		if (d$("woas_cb_js_dyn").checked)
			this.exporter._settings.js_mode = 1;
		else if (d$("woas_cb_js_exp").checked)
			this.exporter._settings.js_mode = 2;
		sep_css = d$("woas_cb_sep_css").checked;
		this.exporter._settings.exp_menus = d$("woas_cb_export_menu").checked;
		this.exporter._settings._main_index = d$("woas_cb_index_main").checked;
		this.exporter._default_ext = d$("woas_ep_ext").value;
		this.exporter._settings.meta_author = this.trim(d$("woas_ep_author").value);
		if (this.exporter._settings.meta_author.length)
			this.exporter._settings.meta_author = '<'+'meta name="author" content="'+this._attrib_escape(this.xhtml_encode(this.exporter._settings.meta_author))+'" />'+"\n";
		this.exporter._settings._unix_norm = d$("woas_cb_unix_norm").checked;
	} catch (e) { this.crash(e); return false; }

	this.progress_init("Exporting XHTML");

	this.exporter._settings.css = this.css.get();
	// add some other CSS which is not used by live WoaS
	this.exporter._settings.css += "\n.woas_broken_link { color: red; text-decoration: underline; }\n";
	if (sep_css) {
		this.exporter._settings.css_path = "woas.css";
		this.exporter._export_fnames_array.push(this.exporter._settings.css_path);
		this.save_file(this.exporter._settings.xhtml_path+this.exporter._settings.css_path, this.file_mode.ASCII_TEXT, this.exporter._settings.css);
		this.exporter._settings.css = "<"+"link rel=\"stylesheet\" type=\"text/css\" media=\"all\" href=\""+this.exporter._settings.css_path+"\" /"+">";
		} else
	this.exporter._settings.css = "<"+"style type=\"text/css\">"+this.exporter._settings.css+"<"+"/style>";

	// actual exporting
	var stats = this.exporter.do_export();

	// refresh if javascript was run
	if (this.exporter._settings.js_mode) {
		this.set_current(current, false);
	}
	// clear allocated resources used during export
	this.exporter.clear();

	this.progress_finish();
	this.alert(this.i18n.EXPORT_OK.sprintf(stats[0], stats[1]));
	return true;
};

var max_keywords_length = 250;
var max_description_length = 250;
// proper autokeywords generation functions begin here
var reKeywords = new RegExp("[^\\s\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{2,}", "g");
function _auto_keywords(source) {
	if (!source.length) return "";
	var words = source.match(reKeywords);
	if ((words===null) || !words.length) return "";
	var nu_words = [], density = [], wp=0, cond;
	for(var i=0;i < words.length;i++) {
		if (words[i].length === 0)
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
	words = [];
	var keywords = "", nw = "";
	density = density.sort(function(a,b){return b.w - a.w;});
	var ol=0;
	for(i=0;i < density.length;i++) {
		nw = nu_words[density[i].i];
		if (ol+nw.length > max_keywords_length)
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
	return this.save_file(dest_path, this.file_mode.BINARY, this.base64.decode(data));
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
