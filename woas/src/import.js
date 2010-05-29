// @module importer

/* NOTES ABOUT PREVIOUS VERSIONS
		0.12.0:
			* introduced some config options: new_tables_syntax, store_mts, folding_style
			* introduced plugins (which deprecate WoaS::Bootscript)
			* dropping support for all WoaS before 0.9.6B
		0.11.7:
			* 'nav_history' config option replaces 'open_last_page'
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
*/

woas.importer = {
//public:
	pages_imported: 0,
	total: 0,

//private:
	// property names used to retrieve default values from stored bitmask
	_settings_props: ["i_comment_js", "i_comment_macros", "i_woas_ns",
	// the last 3 options are ignored for WSIF import
					"i_config", "i_styles", "i_content"],
	// the overwrite option covers bits 6,7
	_OVR_ID: 6,
	// options
	i_config: true,					// import configuration (XHTML only)
	i_styles: false,				// import stylesheet (XHTML only)
	i_content: true,				// import content pages (XHTML only)
	i_comment_js: true,				// disable 'script' tags
	i_comment_macros: true,			// disable macro blocks '<<<...>>>'
	i_woas_ns: true,				// import pages from WoaS:: namespace
	i_overwrite: 1,					// overwrite mode (0 - erase, 1 - ignore, 2 - overwrite, 3 - ask)

	// used internally
	new_main_page: null,
	current_mts: null,
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
		// we did not have a timestamp before 0.10.0
		if (old_version < 100)
			return this.current_mts;
		// will catch the 'undefined' ones also
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
			// can we import from WoaS namespace?
			if (!woas.importer.i_woas_ns)
				return false;
			// never overwrite help pages with old ones
			if (title.indexOf("WoaS::Help::") === 0)
				return false;
			// skip other core WoaS:: pages
			if (woas.static_pages2.indexOf(title) !== -1)
				return false;
			if (title === "WoaS::Custom::CSS")
				// custom CSS is allowed only when importing CSS
				return woas.importer.i_styles;
			
			// here we allow Plugins, Aliases, Hotkeys
			
			return true;
		} else if (title.substr(0, 9) === "Special::") {
			// always skip special pages and consider them system pages

			return false;
		}
		
		// if not on bad list, it's OK
		return true;
	},

	// function used to collect variables
	_get_import_vars: function(data, ignore_array, old_version) {
		var jstrings=[], fail = false;
		// (1) take away all javascript strings (most notably: content and titles)
		// WARNING: quoting hacks lie here!
		data = data.replace(/\\'/g, ":-"+woas.parser.marker).replace(this.reJString, function (str) {
			// restore quotes
			jstrings.push(str.substr(1, str.length-2).replace(woas.importer.reRequote, "\\'"));
			return woas.parser.marker+":"+(jstrings.length-1).toString();
		});
		// (2) rename the variables
		data.replace(/([^\\])\nvar\s+(\w+)\s*=\s*([^;]+);/g, function (str, $1, var_name, definition) {
			if (fail) return;
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
					// consistency check
					if (the_var.length !== woas.importer._reference.length) {
						woas.log("ERROR: page attributes array is not consistent ("+the_var.length+" != "+woas.importer._reference.length+")");
						fail = true;
						break;
					}
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].attrs = the_var[i];
					}
				break;
				case "page_mts": // available only on 0.10.0 and above
					// consistency check
					if (the_var.length !== woas.importer._reference.length) {
						woas.log("WARNING: page timestamps array is not consistent ("+the_var.length+" != "+woas.importer._reference.length+")");
						break;
					}
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].mts = this._fix_mts_val(the_var[i], old_version);
					}
				break;
				case "pages":
					// consistency check
					if (the_var.length !== woas.importer._reference.length) {
						woas.log("ERROR: page bodies array is not consistent ("+the_var.length+" != "+woas.importer._reference.length+")");
						fail = true;
						break;
					}
					for(var i=0,it=the_var.length;i < it;++i) {
						// skip filtered pages
						if (woas.importer._reference[i] === null)
							continue;
						woas.importer._reference[i].body = the_var[i];
					}
				break;
				// silently ignore these
				case "backstack": case "current": break;
				default:
					woas.log("Ignoring unexpected variable "+var_name);
			} // switch
				
		});
		// finished importing variables, clear references array
		this._reference = [];
		// clear partial results on failure
		if (fail)
			this.pages = [];
		woas.log("get_import_vars() scanned "+this.pages.length+" page definitions");
	},

	// apply options i.e. javascript security settings
	_hotfix_on_import: function(NP) {
		// exit if no replace is needed
		if (!this.i_comment_js && !this.i_comment_macros)
			return;
		// only plain wiki and locked pages can be hotfixed
		if (NP.attrs > 1)
			return;
		// comment out all javascript blocks
		var snippets = [];
		// put away XHTML comments and nowiki blocks
		NP.body = NP.body.replace(reComments, function (str, $1, dynamic_nl) {
				var r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
				snippets.push(str);
				return r;
		}).replace(reNowiki, function (str, $1, dynamic_nl) {
				var r = woas.parser.place_holder(snippets.length, "", dynamic_nl);
				snippets.push(str);
				return r;
		});
		if (this.i_comment_js)
			NP.body = NP.body.replace(reScripts, "<"+"disabled_script$1>$2<"+"/disabled_script>$3");
		if (this.i_comment_macros)
			NP.body = NP.body.replace(reMacros, "<<< Macro disabled\n$1>>>$2");
		// clear dynamic newlines
		NP.body = NP.body.replace(woas.parser.reNL_MARKER, "");
		// restore everything
		woas.parser.undry(NP, snippets);
	},
	
	// add directly without checking for duplicates
	//NOTE: will not set 'pi' property
	_inject_import_hook: function(page) {
		page_titles.push(page.title);
		pages.push(page.body);
		page_attrs.push( page.attrs );
		// during import timestamp is already fixed when originally reading the variable
		page_mts.push(page.mts);
		// set self reference
		page.i = pages.length-1;
		return true;
	},
	
	_core_import_hook: function(page) {
//		woas.log("Importing page "+page.title);	//log:0
		var pi = woas.page_index(page.title);
		if (pi === -1) { // new page title
			woas.importer._inject_import_hook(page);
			page.pi = -1;
		} else { // page already existing, overwriting
			if (woas.importer.i_overwrite === 1) {
				// ignore already-existing pages
				return false;
			} else if (woas.importer.i_overwrite === 3) {
				if (!confirm(woas.i18n.CONFIRM_OVERWRITE.sprintf(page.title)))
					return false;
			}
			page_titles[pi] = page.title;
			pages[pi] = page.body;
			page_attrs[pi] = page.attrs;
			page_mts[pi] = page.mts;
			page.i = page.pi = pi;
		}
		return true;
	},
	
	// normal import hook - shared for XHTML and WSIF import
	_import_hook: function(page) {
		var that = woas.importer;
		that._hotfix_on_import(page);

		that._core_import_hook(page);

		// take note of plugin pages and other special runtime stuff
		var _pfx = "WoaS::Plugins::";
		if (page.title.substr(0, _pfx.length) === _pfx) {
			// does plugin already exist?
			if (page.pi !== -1)
				that._plugins_update.push(page.title.substr(_pfx.length));
			else
				that._plugins_add.push(page.title.substr(_pfx.length));
		} else if (page.title === "WoaS::Aliases")
			// check if we need to update aliases and hotkeys
			that._update_aliases = true;
		else if (page.title === "WoaS::Hotkeys")
			that._update_hotkeys = true;
		else if (page.title === "WoaS::CSS::Custom")
			that._update_css = true;
		
		return true;
	},
	
	_clear: function() {
//		this.pages = [];
		this._update_css = false;
		this._update_aliases = false;
		this._update_hotkeys = false;
		this._plugins_add = [];
		this._plugins_update = [];
	},
	
	_old_version: null,
	_upgrade_content: function (P) {
		var that = woas.importer;
		// fix the old bootscript page
		if (that._old_version < 120) {
			if (P.title === "WoaS::Bootscript") {
				// convert old base64 bootscript to plain text
				if (that._old_version < 107)
					that._bootscript_code = woas.base64.decode(P.body);
				else
					that._bootscript_code = P.body;
				that.pages_imported++;
				woas.progress_status(that.pages_imported/that.pages.length);
				return false;
			}
		} // since 0.12.0 we no more have a bootscript page

		// check that imported image is valid
		if (P.attrs & 8) {
			// the image is not valid as-is, attempt to fix it
			if (!that.reValidImage.test(P.body)) {
				// do not continue with newer versions or if not base64-encoded
				if ((that._old_version>=117) || !woas.base64.reValid.test(P.body)) {
					woas.log("Skipping invalid image "+P.title);
					return false;
				}
				// we assume that image is double-encoded
				P.body = woas.base64.decode(P.body);
				// check again for validity
				if (!that.reValidImage.test(P.body)) {
					woas.log("WARNING: skipping invalid image "+P.title); //log:1
					return false;
				}
				woas.log("Fixed double-encoded image "+P.title); //log:1
			}
			// try to fix the 'undefined' mime type bug
			if (that._old_version < 120) {
				if (that.reImageBadMime.test(P.body))
					// attempt to find the correct mime
					P.body = "data:"+woas._guess_mime(P.title)+P.body.substr(14);
			}
		} // check images

		// fix the trailing nul bytes bug in encrypted pages
		// extended from 0.10.4 to 0.12.0 because was not fixed on new pages
		if ((that._old_version>=102) && (that._old_version<120)
			&& (P.attrs & 2)) {
			var rest = P.body.length % 16;
			if (rest) {
				woas.log("removing "+rest+" trailing bytes from page "+P.title); //log:1
				while (rest-- > 0) {P.body.pop();}
			}
		}
			
		// proceed to actual import
		if (that._import_hook(P)) {
			++that.pages_imported;
			woas.progress_status(that.pages_imported/that.pages.length);
		}
		return true;
	},
	
	_import_content: function(old_version) {
		this._old_version = old_version;
		for (var i=0; i < this.pages.length; i++) {
			this._upgrade_content(this.pages[i]);
		}
	},
	
	do_import: function(ct) {
		// initialize
		this.pages_imported = 0;
		this.total = 0;

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
		woas.log("Imported file version string: "+ver_str);	// log:1
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
			old_cfg;
		if (this.i_config)
			old_cfg = d$.clone(woas.config);
			
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
				// add the new safe mode
				if (old_version < 112) {
					woas.config.safe_mode = old_cfg.safe_mode;
					//NOTE: WSIF datasource options are not imported at all
				}
				// renamed one config option
				if (old_version < 117) {
					woas.config.nav_history = woas.config.open_last_page;
					delete woas.config.open_last_page;
				}
				// introduced new options
				if (old_version < 120) {
					woas.config.new_tables_syntax = old_cfg.new_tables_syntax;
					woas.config.store_mts = old_cfg.store_mts;
					woas.config.folding_style = old_cfg.folding_style;
					woas.config.import_settings = old_cfg.import_settings;
				}
				// check for any undefined config property - for safety
				for(p in woas.config) {
					// remove things from the past
					if (typeof old_cfg[p] == "undefined") {
						woas.log("BUG: removing invalid config option '"+p+"'");
						delete woas.config[p];
						continue;
					}
					if ((typeof woas.config[p] == "undefined") && (typeof old_cfg[p] != "undefined"))
						woas.config[p] = old_cfg[p];
				}
				
				// put back the old values for WSIF datasource
				woas.config.wsif_author = old_cfg.wsif_author;
				woas.config.wsif_ds = old_cfg.wsif_ds;
				woas.config.wsif_ds_lock = old_cfg.wsif_ds_lock;
				woas.config.wsif_ds_multi = old_cfg.wsif_ds_multi;
				
			} // done importing config object
		} // i_config

		// modified timestamp for pages before 0.10.0
		this.current_mts = Math.round(new Date().getTime()/1000);
		
		// import the pages data
		this._get_import_vars(data, ['woas', '__marker', 'version', '__config'],
							old_version);
		// some GC help
		data = null;
		
		// apply upgrade fixes
		if (this.i_content) {
			this._import_content(old_version);
			this.total = this.pages.length;
			// GC cleanup
			this.pages = [];
		}
		
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
		if (this.i_config) {
			if (old_version<=108)
				woas.config.main_page = old_cfg.main_page;
			// apply the new main page if that page exists
			if ((this.new_main_page !== old_cfg.main_page) && woas.page_exists(this.new_main_page))
				woas.config.main_page = this.new_main_page;
		}
		
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
			woas.log("Old bootscript code will be imported as "+chosen_name);
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
		
		// clear everything else
		this._clear();

		// return false on failure
		return !fail;
	},
	
	_after_import: function() {
		var that = woas.importer;
		// refresh in case of CSS, aliases and/or hotkeys modified
		if (that._update_css)
			woas.css.set(woas.get_text("WoaS::CSS::Core")+"\n"+woas.get_text("WoaS::CSS::Custom"));
		if (that._update_aliases)
			woas._load_aliases(woas.get_text("WoaS::Aliases"));
		if (that._update_hotkeys)
			woas.hotkey.load(woas.get_text("WoaS::Hotkeys"));
		
		// add/update plugins
		for(var i=0,it=that._plugins_update.length;i < it;++i) {
			woas.plugins.update(that._plugins_update[i]);
		}
		for(var i=0,it=that._plugins_add.length;i < it;++i) {
			// plugin should be on the list
			woas.plugins._all.push(that._plugins_add[i]);
			woas.plugins.enable(that._plugins_add[i]);
		}
		
	},

	// regular expressions used to not mess with title/content strings
	reRequote: new RegExp(":-"+woas.parser.marker, "g"),
	reJString: new RegExp("'[^']*'", "g"),
	reJStringRep: new RegExp(woas.parser.marker+":"+"(\\d+)", "g"),
	reValidImage: /^data:\s*[^;]*;\s*base64,\s*/,
	reImageBadMime: /^data:undefined;\s*base64,\s*/,
	reOldStyleBlock: new RegExp("<"+"style\\s.*?type=\"?text\\/css\"?[^>]*>((\\n|.)*?)<"+"\\/style>", "i")

};

// called from Special::Import - import WoaS from XHTML file
woas.import_wiki = function() {
	if (!woas._import_pre_up(true))
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

	var rv = this.importer.do_import(ct);
	
	// remove hourglass
	this.progress_finish();
	
	if (rv) {
		// inform about the imported pages / total pages present in file
		this.alert(this.i18n.IMPORT_OK.sprintf(this.importer.pages_imported+"/"+this.importer.total,
												this.importer.total - this.importer.pages_imported));
		
		// move to main page
		current = this.config.main_page;
	}
	
	// always save if we have erased the wiki
	if ((this.importer.i_overwrite === 0) || rv)
		this.full_commit();

	if (rv) {
		this.refresh_menu_area();
		this.set_current(this.config.main_page, true);
	}
	
	// supposedly, everything went OK
	return rv;
};

woas._file_ext = function(fn) {
	var m=fn.match(/\.(\w+)$/);
	if (m === null) return "";
	return "."+m[1];
};

woas._import_pre_up = function(all_options) {
	// check if this WoaS is read-only
	if (!this.config.permit_edits) {
		this.alert(woas.i18n.READ_ONLY);
		return false;
	}
	// grab the common options
	this.importer.i_comment_js = d$.checked("woas_cb_import_comment_js");
	this.importer.i_comment_macros = d$.checked("woas_cb_import_comment_macros");
	this.importer.i_woas_ns = d$.checked("woas_cb_import_woas_ns");
	//NOTE: i_overwrite is automatically set when clicking
	if (all_options) {
		// grab the XHTML-only options
		this.importer.i_styles = d$.checked('woas_cb_import_styles');
		this.importer.i_config = d$.checked('woas_cb_import_config');
		this.importer.i_content = d$.checked('woas_cb_import_content');
	} else {
		// these options are not available for WSIF
		this.importer.i_styles = this.importer.i_content = true;
	}
	
	var old_is = woas.config.import_settings;
	// now store these values
	woas.config.import_settings = this.bitfield.get_object(this.importer, this.importer._settings_props);
	// set also bits for overwrite options
	woas.config.import_settings = this.bitfield.set(this.config.import_settings, this.importer._OVR_ID,
									this.importer.i_overwrite & 1, this.config.import_settings);
	woas.config.import_settings = this.bitfield.set(this.config.import_settings, this.importer._OVR_ID+1,
									this.importer.i_overwrite & 2, this.config.import_settings);
	// check if configuration changed
	this.cfg_changed |= (woas.config.import_settings !== old_is);
	// check if user wants total erase before going on
	if (this.importer.i_overwrite === 0) {
		if (!this.erase_wiki())
			return false;
	}
	
	return true;
};

// called from Special::ImportWSIF
woas.import_wiki_wsif = function() {
	if (!woas._import_pre_up(false))
		return false;
	
	// automatically retrieve the filename (will call load_file())
	var done = woas._native_wsif_load(null, false /* no locking */, false /* not native */, 0,
			this.importer._upgrade_content, this.importer._filter_by_title,
			this.importer._after_import);
	if (done === false && (woas.wsif.emsg !== null))
		this.crash(woas.wsif.emsg);

	if (done !== false) {
		// add some info about total pages
		var skipped;
		if (this.wsif.expected_pages !== null) {
			skipped = this.wsif.expected_pages-done;
			done = String(done)+"/"+woas.wsif.expected_pages;
		} else skipped = 0;
		this.alert(woas.i18n.IMPORT_OK.sprintf(done, skipped));
		this.refresh_menu_area();
		// now proceed to actual saving
		this.commit(woas.wsif.imported);
	} else {
		// always save if we have erased the wiki
		if (this.importer.i_overwrite === 0)
			this.full_commit();
	}

	return done;
};
