// Module used for import

/* NOTES ABOUT BACKWARD IMPORT SUPPORT
		0.12.0:
			* introduced some config options: new_tables_syntax, store_mts, folding_style
			* introduced plugins (which deprecate WoaS::Bootscript)
			* dropping support for all WoaS before 0.9.6B
		0.11.2:
			* introduced parsing mechanism which does not mess with var declarations inside JavaScript strings
			* introduced WoaS::Hotkeys, WoaS::CSS::Core, WoaS::CSS::Custom
			* introduced woas.config.safe_mode option
			* introduced woas.config.wsif_ds* options
		0.10.7:
			* introduced WoaS::Plugins and changed WoaS::Bootscript page type from embedded to normal
		0.10.0:
			* introduced page_mts for global page modified timestamp
		0.9.7:
			* introduced WoaS::Aliases
		0.9.6:
			* Special::Bootscript -> WoaS::Bootscript
		0.9.5D (not released)
			* Javascript:: reserved namespace
			* some Special:: pages no more work
		0.9.5B
			* object orientation of code
			* server_mode disappears
		0.9.4B
			* introduced Special::Bootscript
*/

woas.importer = {
	// options
	i_config: true,
	i_styles: false,
	i_content: true,
	
	new_main_page: null,
	current_mts: null,
	pages_imported: 0,
	total: 0,
	sys_pages: 0,
	pages: [],			// imported page objects array
	_reference: [],		// linear array containing page id or null, used privately by _get_import_vars()
	
	// runtime dynamic update variables
	_plugins_update: [],
	_plugins_add: [],
	_update_css: false,
	_update_hotkeys: false,
	_update_aliases: false,
	_bootscript_code: "",

	_fix_mts_val: function(mts, old_version) {
		// we did not have a timestamp there
		if (old_version < 100)
			return this.current_mts;
		// will catch the 'undefined' ones
		if (!mts)
			return 0;
		// fixup the mts value in some old buggy version
		if ((old_version===100) || (old_version===101)) {
			// ignore the old null value
			if (mts === 0x4b61cbad)
				mts = 0;
		}
		return mts;
	},
	
	_filter_by_title: function(title) {
		// we are not using is_reserved() because will be inconsistant in case of enabled edit_override
		// check pages in WoaS:: namespace
		if (title.substr(0,6) === "WoaS::") {
			// do not overwrite help pages with old ones
			if (title.indexOf("WoaS::Help::") === 0)
				return false;
			// skip other core WoaS:: pages
			if (woas.static_pages2.indexOf(title) !== -1)
				return false;
			if (title === "WoaS::Custom::CSS") {
				// custom CSS is allowed only when importing CSS
				return this.i_styles;
			}
			
			// here we allow Plugins, Aliases, Hotkeys
			return true;
		} else if (title.substr(0, 9) === "Special::") {
			// always skip special pages and consider them system pages
			++this.sys_pages;

			return false;
		}
		
		// if not on bad list, it's OK
		return true;
	},

	// function used to collect variables
	_get_import_vars: function(data, ignore_array, old_version) {
		var jstrings=[];
		// (1) take away all javascript strings (most notably: content and titles)
		// WARNING: quoting hacks lie here!
		data = data.replace(/\\'/g, ":-"+parse_marker).replace(this.reJString, function (str) {
			// restore quotes
			jstrings.push(str.substr(1, str.length-2).replace(woas.importer.reRequote, "\\'"));
			return parse_marker+":"+(jstrings.length-1).toString();
		});
		// (2) rename the variables
		data.replace(/([^\\])\nvar\s+(\w+)\s*=\s*([^;]+);/g, function (str, $1, var_name, definition) {
			// it must not be in array
			if (ignore_array.indexOf(var_name) !== -1)
				return;
			if (
					// main_page was not in config object for 0.10.8 and below
					(old_version <= 108) && (var_name === "main_page") ) {
				woas.importer.new_main_page = woas.eval(definition.replace(woas.importer.reJStringRep,
								function (str, id) { return "'"+jstrings[id]+"'";}
							), true);
				return;
			}
			// the rest of variables are for content, so exit if we don't want content
			if (!woas.importer.i_content)
				return;
			// save evaluation if we don't want last modified timestamp
			if (!woas.config.store_mts && (var_name === "page_mts"))
				return;
			
			// evaluate the real array
			var the_var = woas.eval(definition.replace(woas.importer.reJStringRep,
								function (str, id) { return "'"+jstrings[id]+"'";}
							), true);

			// OK, we want this variable, evaluate it
			switch (var_name) {
				case "page_titles":
					// titles come before other properties, so we create all objects now
					for(var i=0,it=the_var.length;i < it;++i) {
						// call the title filtering hook
						if (woas.importer._filter_by_title(the_var[i])) {
							woas.importer.pages.push( { title: the_var[i], attrs: 0,
												mts: (old_version > 97) ? 0 : (woas.config.store_mts ? woas.importer.current_mts : 0),
												body: null } );
							// add object by-ref
							woas.importer._reference.push( woas.importer.pages[woas.importer.pages.length-1] );
						} else // no page reference
							woas.importer._reference.push( null );
					}
				break;
				case "page_attrs":
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].attrs = the_var[i];
					}
				break;
				case "page_mts": // available only on 0.10.0 and above
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].mts = this._fix_mts_val(the_var[i], old_version);
					}
				break;
				case "pages":
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].body = the_var[i];
					}
				break;
				default:
					woas.log("Ignoring unexpected variable "+var_name);
			} // switch
				
		});
		// finished importing variables, clear references array
		this._reference = [];
		woas.log("get_import_vars() scanned "+this.pages.length+" page definitions");
	},
	
	// normal import hook
	_import_hook: function(page) {
		woas.log("Importing page "+page.title);
		var pi = woas.page_index(page.title);
		if (pi === -1) {
			page_titles.push(page.title);
			pages.push(page.body);
			page_attrs.push( page.attrs );
			// timestamp already fixed when reading the variable
			page_mts.push(page.mts);
		} else { // page already existing, overwrite it
			page_titles[pi] = page.title;
			pages[pi] = page.body;
			page_attrs[pi] = page.attrs;
			page_mts[pi] = page.mts;
		}

		// take note of plugin pages and other special runtime stuff
		var _pfx = "WoaS::Plugins::";
		if (page.title.substr(0, _pfx.length) === _pfx) {
			// does plugin already exist?
			if (pi !== -1)
				this._plugins_update.push(page.title.substr(_pfx.length));
			else
				this._plugins_add.push(page.title.substr(_pfx.length));
		} else if (page.title === "WoaS::Aliases")
			// check if we need to update aliases and hotkeys
			this._update_aliases = true;
		else if (page.title === "WoaS::Hotkeys")
			this._update_hotkeys = true;
		else if (page.title === "WoaS::CSS::Custom")
			this._update_css = true;
		
		return true;
	},
	
	_clear: function() {
		this.pages = [];
		this._update_css = false;
		this._update_aliases = false;
		this._update_hotkeys = false;
		this._plugins_add = [];
		this._plugins_update = [];
		this.pages_imported = 0;
		this.sys_pages = 0;
	},
	
	_import_content: function(old_version) {
		for (var i=0; i < this.pages.length; i++) {
			// fix the old bootscript page
			if (old_version < 120) {
				if (pages[i].title === "WoaS::Bootscript") {
					// convert old base64 bootscript to plain text
					if (old_version < 107)
						this._bootscript_code = woas.base64.decode(pages[i].body);
					else
						this._bootscript_code = pages[i].body;
					this.pages_imported++;
					woas.progress_status(this.pages_imported/this.pages.length);
					continue;
				}
			} // from 0.12.0 we no more have a bootscript page

			// check that imported image is valid
			if (this.pages[i].attrs & 8) {
				// the image is not valid as-is, attempt to fix it
				if (!this.reValidImage.test(this.pages[i].body)) {
					// do not continue with newer versions or if not base64-encoded
					if ((old_version>=117) || !woas.base64.reValid.test(this.pages[i].body)) {
						log("Skipping invalid image "+this.pages[i].title);
						continue;
					}
					// we assume that image is double-encoded
					this.pages[i].body = woas.base64.decode(this.pages[i].body);
					// check again for validity
					if (!this.reValidImage.test(this.pages[i].body)) {
						log("Skipping invalid image "+this.pages[i].title); //log:1
						continue;
					}
					log("Fixed double-encoded image "+this.pages[i].title); //log:1
				}
			} // check images

			// fix the trailing nul bytes bug in encrypted pages
			// extended from 0.10.4 to 0.12.0 because was not fixed on new pages
			if ((old_version>=102) && (old_version<120)
				&& (this.pages[i].attrs & 2)) {
				var rest = this.pages[i].body.length % 16;
				if (rest) {
					woas.log("removing "+rest+" trailing bytes from page "+this.pages[i].title); //log:1
					while (rest-- > 0) {this.pages[i].body.pop();}
				}
			}
					
			// proceed to actual import
			if (this._import_hook(this.pages[i])) {
				++this.pages_imported;
				woas.progress_status(this.pages_imported/this.pages.length);
			}
		
		} // for cycle

	},
	
	do_import: function(ct) {
		var fail=false;
		
		do { // a fake do...while to ease failure return
		
		// get WoaS version
		var old_version,
			ver_str = ct.match(/var woas = \{"version":\s+"([^"]+)"\s*\};(\r\n|\n)/);
		if (!ver_str || !ver_str.length) {
			woas.alert("Could not determine WoaS version\n"+woas.i18n.IMPORT_OLD_VER);
			fail = true;
			break;
		}
		ver_str = ver_str[1];
		log("Imported file version string: "+ver_str);	// log:1
		switch (ver_str) {
			case "0.9.6B":
			case "0.9.7B": // never released officially
				ver_str = ver_str.substr(0, ver_str.length-2);
			case "0.10.0": case "0.10.1":
			case "0.10.2": case "0.10.3":
			case "0.10.4": case "0.10.5":
			case "0.10.6": case "0.10.7":
			case "0.10.8": case "0.10.9":
			case "0.11.0": case "0.11.1":
			case "0.11.2": case "0.11.3":
			case "0.11.4": case "0.11.5":
			case "0.11.6": case "0.11.7":
			case "0.11.8": case "0.11.9":
			case "0.12.0":
			old_version = Number(ver_str.substr(2).replace(/\./g, ""));
				break;
			default:
				woas.alert(woas.i18n.IMPORT_INCOMPAT.sprintf(ver_str)+woas.i18n.IMPORT_OLD_VER);
				fail=true;
		}
		if (fail) break;

		// import the variables
		var	imported_css = null,
			// used during import from older versions
			old_cfg = $.clone(woas.config);
			
		this.new_main_page = woas.config.main_page

		// locate the random marker
		var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/);
		if (!old_marker) {
			woas.alert(woas.i18n.ERR_MARKER);
			fail = true;
		}
		if (fail) break;
		old_marker = old_marker[1];

		// import the CSS head tag in versions before 0.11.2
		if (this.i_styles && (old_version < 112)) {
			ct.replace(this.reOldStyleBlock, function (str, $1) {
				imported_css = $1;
			});
		} // 0.11.2+, we'll manage CSS import at the page level

		var data = woas._extract_src_data(old_marker, ct, true, this.new_main_page, true);
		// some GC help: we no more need the big content variable
		ct = null;		
		
		if (this.i_config) {
			var cfgStartMarker = 'woas["'+'config"] = {',
				// grab the woas config definition
				cfg_start = data.indexOf(cfgStartMarker),
				cfg_found = false;
			
			if (cfg_start !== -1) {
				var cfg_end = data.indexOf('}', cfg_start+cfgStartMarker.length);
				if (cfg_end !== -1) {
					woas.config = woas.eval(data.substring(cfg_start+cfgStartMarker.length-1, cfg_end+1), true);
					cfg_found = !woas.eval_failed;
				}
			}
						
			if (!cfg_found) {
				woas.log("Failed to import old configuration object");
			} else {
				// add the new debug option
				if (old_version<=107)
					woas.config.debug_mode = old_cfg.debug_mode;
				// add the new safe mode and WSIF DS options
				if (old_version < 112) {
					woas.config.safe_mode = old_cfg.safe_mode;
					woas.config.wsif_author = old_cfg.wsif_author;
					woas.config.wsif_ds = old_cfg.wsif_ds;
					woas.config.wsif_ds_lock = old_cfg.wsif_ds_lock;
					woas.config.wsif_ds_multi = old_cfg.wsif_ds_multi;
				}
				if (old_version < 120) {
					woas.config.new_tables_syntax = old_cfg.new_tables_syntax;
					woas.config.store_mts = old_cfg.store_mts;
					woas.config.folding_style = old_cfg.folding_style;
				}
				// check for any undefined config property - for safety
				for(p in woas.config) {
					if ((typeof woas.config[p] == "undefined") && (typeof old_cfg[p] != "undefined"))
						woas.config[p] = old_cfg[p];
				}
			} // done importing config object
		} // i_config

		// modified timestamp for pages before 0.10.0
		this.current_mts = Math.round(new Date().getTime()/1000);
		
		// import the pages data
		this._get_import_vars(data, ['woas', '__marker', 'version', '__config'],
							old_version);
			
		// some GC help
		data = null;
		
		// **** COMMON IMPORT CODE ****
		if (this.i_content)
			this._import_content(old_version);
		
		// eventually add the new missing page
		if (old_version <= 112) {
			// take care of custom CSS (if any)
			if (imported_css !== null) {
				// import it as a page
				this._import_hook( {
					title: "WoaS::CSS::Custom",
					attrs: 0,
					mts: woas.config.store_mts ? this.current_mts : 0,
					body: imported_css
				} );
			}
		}
		// set the new config variable
		if (old_version<=108)
			woas.config.main_page = old_cfg.main_page;
		// apply the new main page if that page exists
		if ((this.new_main_page !== old_cfg.main_page) && woas.page_exists(this.new_main_page))
			woas.config.main_page = this.new_main_page;
		
		} while (false); // fake do..while ends here
		
		// fix configuration for older versions
		if (old_version < 114) {
			if (!woas.config.nav_history) {
				// reset some variables which were not reset in those older versions
				backstack = [];
				current = woas.config.main_page;
			}
		}

		// if there is bootscript code, create a new plugin for it
		// skip empty bootscripts and also default bootscript
		var trimmed_bs = woas.trim(this._bootscript_code);
		if ((trimmed_bs.length !== 0) && (trimmed_bs !== '/* insert here your boot script */')
			&& (trimmed_bs !== '// Put here your boot javascript')) {
			var chosen_name = "WoaS::Plugins::Bootscript", base_name = chosen_name, i=0;
			while (page_titles.indexOf(chosen_name) !== -1) {
				chosen_name = base_name + "_" + (i++).toString();
			}
			log("Old bootscript code will be imported as "+chosen_name);
			// now create such plugin by directly importing it
			this._import_hook( {
				title: chosen_name,
				body: "/* This JavaScript code was automatically imported by WoaS from your former WoaS::Bootscript */\n"+this._bootscript_code,
				attrs: 0,
				mts: woas.config.store_mts ? this.current_mts : 0
			} );
		}
		
		// always update run-time stuff, even on failure
		this._after_import();
		
		this.total = this.pages.length;
		// clear everything off
		this._clear();

		// return false on failure
		return !fail;
	},
	
	_after_import: function() {
		// refresh in case of CSS, aliases and/or hotkeys modified
		if (this._update_css)
			woas.css.set(woas.get_text("WoaS::CSS::Core")+"\n"+woas.get_text("WoaS::CSS::Custom"));
		if (this._update_aliases)
			woas._load_aliases(woas.get_text("WoaS::Aliases"));
		if (this._update_hotkeys)
			woas._load_hotkeys(woas.get_text("WoaS::Hotkeys"));
		
		// add/update plugins
		for(var i=0,it=this._plugins_update.length;i < it;++i) {
			woas.plugins.update(this._plugins_update[i]);
		}
		for(var i=0,it=this._plugins_add.length;i < it;++i) {
			woas.plugins.enable(this._plugins_add[i]);
		}
		
	},

	// regular expressions used to not mess with title/content strings
	reRequote: new RegExp(":-"+parse_marker, "g"),
	reJString: new RegExp("'[^']*'", "g"),
	reJStringRep: new RegExp(parse_marker+":"+"(\\d+)", "g"),
	reValidImage: /^data:\s*[^;]*;\s*base64,\s*/,
	reOldStyleBlock: new RegExp("<"+"style\\s.*?type=\"?text\\/css\"?[^>]*>((\\n|.)*?)<"+"\\/style>", "i")

};

woas._file_ext = function(fn) {
	var m=fn.match(/\.(\w+)$/);
	if (m === null) return "";
	return "."+m[1];
};

woas.import_wiki = function() {

	if(confirm(this.i18n.CONFIRM_IMPORT_OVERWRITE) === false)
		return false;

	// set hourglass
	this.progress_init("Import WoaS");

	// file will be loaded as ASCII to overcome browsers' limitations
	var ct = this.load_file(null, this.file_mode.ASCII_TEXT);
	if (ct === null) {
		// remove hourglass
		this.progress_finish();
		return false;
	}
	if (ct === false) {
		this.alert(this.i18n.LOAD_ERR);
		// remove hourglass
		this.progress_finish();
		return false;
	}
	
	this.importer.i_styles = $('cb_import_css').checked;
	this.importer.i_content = $('cb_import_content').checked
	
	var rv = this.importer.do_import(ct);
	
	// remove hourglass
	this.progress_finish();
	
	if (!rv)
		return false;

	// inform about the imported pages / total pages present in file
	this.alert(this.i18n.IMPORT_OK.sprintf(this.importer.pages_imported+"/"+
				(this.importer.total-this.importer.sys_pages).toString(), this.importer.sys_pages));
	
	// move to main page
	current = this.config.main_page;
	// save everything
	this.full_commit();
	
	this.refresh_menu_area();
	this.set_current(this.config.main_page, true);
	
	// supposedly, everything went OK
	return true;
};

/*** generic import code follows ***/

var _wsif_js_sec = {
	"comment_js": true,
	"comment_macros": true,
	"woas_ns": true
};

// apply some javascript security settings
function _import_wsif_pre_hook(NP) {
	// always import special pages because filtering is handled in wsif.js
	if (NP.title.indexOf("Special::")===0)
		return true;
	// check if page needs to be skipped
	if (_wsif_js_sec.woas_ns) {
		if (NP.title.indexOf("WoaS::")===0)
			return false;
	} else {
		// directly import these pages
		if (NP.title.indexOf("WoaS::")===0)
			return true;
	}
	// only plain wiki and locked pages can be hotfixed
	if (NP.attrs > 1)
		return true;
	// comment out all javascript blocks
	var snippets = [];
	// put away text in nowiki blocks
	var page = NP.page.replace(reNowiki, function (str, $1) {
		var r = "<"+"!-- "+parse_marker+"::"+snippets.length+" --"+">";
		snippets.push($1);
		return r;
	});
	if (_wsif_js_sec.comment_js) {
		page = page.replace(reScripts, "<"+"disabled_script$1>$2<"+"/disabled_script>");
		NP.modified = true;
	}
	if (_wsif_js_sec.comment_macros) {
		page = page.replace(reMacros, "<<< Macro disabled\n$1>>>");
		NP.modified = true;
	}
	if (NP.modified) {
		// put back in place all HTML snippets
		if (snippets.length>0) {
			NP.page = page.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
				return "{{{"+snippets[parseInt($1)]+"}}}";
			});
		} else
			NP.page = page;
	}
	return true;
}
