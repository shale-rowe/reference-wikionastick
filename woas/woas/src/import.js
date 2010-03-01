/*** import.js ***/


	function get_import_vars(data, ignore) {
		var c=[];
		// rename the variables
		data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
			if (ignore && ignore.indexOf($2)!=-1)
				return "\nvar ignoreme = ";
			c.push('sw_import_'+$2);
			return $1+"\nvar sw_import_"+$2+" = ";
		});//.replace(/\\\n/g, '');
		log("collected variables = "+c);	// log:1

		c = eval(data+"\n["+c+"];");
		return c;
	}


woas["import_wiki"] = function(filename) {
	if(confirm("This will OVERWRITE pages with the same title.\n\nAre you sure you want to continue?") == false)
		return false;

	// set hourglass
	document.body.style.cursor= "wait";

	var ct = loadFile(filename);

	var import_css = $('cb_import_css').checked;
	var import_content = $('cb_import_content').checked;
	log("import_content = "+import_content); // log:1
	var import_icons = $('cb_import_icons').checked;

	// get version
	var old_version;
	var ver_str = ct.match(/<div .*?id=("version_"|version_).*?>([^<]+)<\/div>/i);
	if (ver_str && ver_str.length>1) {
		ver_str = ver_str[2];
		log("Importing wiki with version string \""+ver_str+"\"");	// log:1
		switch(ver_str)
		{
			case "0.03":
				old_version = 3;
				break;
			case "0.04":
			case "0.04G":
				old_version = 4;
				break;
			default:
				alert("Incompatible version: " + ver_str);
				document.body.style.cursor= "auto";
				return false;
		}
	} else {
		var ver_str = ct.match(/var version = "([^"]*)";(\r\n|\n)/);
		if (!ver_str)
			ver_str = ct.match(/var woas = \{"version":\s+"([^"]+)"\s*\};(\r\n|\n)/);
		if (ver_str && ver_str.length) {
			ver_str = ver_str[1];
			log("Version string: "+ver_str);	// log:1
			switch (ver_str) {
				case "0.9B":
				case "0.9":
					old_version = 9;
				break;
				case "0.9.2B":
					old_version = 92;
				break;
				case "0.9.3B":
					old_version = 93;
				break;
				case "0.9.4B":
					old_version = 94;
				break;
				case "0.9.5B":
				case "0.9.5C":
//				case "0.9.5D":
					old_version = 95;
				break;
				case "0.9.6B":
					old_version = 96;
					break;
				default:
					alert("Incompatible version: " + ver_str);
					document.body.style.cursor= "auto";
					return false;
			}
		} else {
			log("Maybe version 0.02?");	// log:1
			old_version = 2;
			if(ct.match("<div id=\"?"+escape("Special::Advanced")))
				old_version = 3;
		}
	}


	// import the variables
	var new_main_page = main_page;
	var old_block_edits = !this.config.permit_edits;
	var page_names = [];
	var page_contents = [];
	var old_page_attrs = [];
	var pc = 0;

// old versions parsing
if (old_version	< 9) {

	var wiki;
	try {
		wiki = ct.match(/<div .*?id=(wiki|"wiki")[^_\\]*?>((.|\n|\t|\s)*)<\/div>/i)[0];
	} catch(e) {
		alert("Unrecognized file");
		document.body.style.cursor= "auto";
		return false;
	}

	// eliminate comments
	wiki = wiki.replace(/\<\!\-\-.*?\-\-\>/g, "");

	// separate variables from wiki
	var vars;
	var p = wiki.search(/<div .*?id=("variables"|variables)[^>]*?>/i);
	if (p!=-1) {
		vars = wiki.substring(p);
		wiki = wiki.substring(0, p);
	} else
		vars = "";

	if(old_version == 2) {
		try {
			vars = wiki.match(/\<div .*?id=("main_page"|main_page)>(.*?)\<\/div\>/i)[1];
		} catch(e) {
//			log("No variables found");	// log:0
		}
	}

	/* NOTES ABOUT OLD VERSIONS
	v0.9.6:
		* Special::Bootscript -> WoaS::Bootscript

	v0.9.5D (not released)
		* Javascript:: reserved namespace
		* some Special:: pages no more work
	v0.9.5B
		* object orientation of code
		* server_mode disappears
	v0.9.4B
		* introduced Special::Bootscript
	v0.04
		* permit_edits variable appeared here
	v0.02
		* pages were not escaped
	*/


	// get an array of variables and wikis
	var var_names = [];
	var var_values = [];
	var vc = 0;

	// eliminate headers
	wiki = wiki.substring(wiki.indexOf(">")+1);
	vars = vars.substring(vars.indexOf(">")+1);

	vars.replace(/<div id="?(version_|main_page_|permit_edits_|[\w_]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2) {
				if(old_version == 2)
					var_names[vc] = "main_page_";
				else
					var_names[vc] = $1;
				var_values[vc] = $2;
				vc++;
			});

//	log("Variables are ("+var_names+")");	// log:0

	// now extract the pages from old versions < 0.9
	if (import_content) {
		wiki.replace(/<div .*?id="?([^">]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2, $3) {
//				log("Parsing old page "+$1);	// log:0
				if (old_version != 2) {
					page_names[pc] = unescape($1);
					page_contents[pc] = unescape($2);
				} else {
					page_names[pc] = $1;
					page_contents[pc] = $2;
				}
				// throw away old special pages
				if (page_names[pc].indexOf("Special::")===0) {
					if (page_names[pc].search(/Special::Edit Menu/i)==0)
						page_names[pc] = "::Menu";
					else return;
				}

				old_page_attrs[pc] = 0;

				if (old_version < 9) {	// apply compatibility changes to stickwiki versions below v0.9
					page_contents[pc] = _new_syntax_patch(page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special::Import]]").replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
					function (str, $1, $2, $3) {
						if ($3)
							return "[["+$3+"|"+$1+"]]";
						else
							return str;
					}));
				}
				pc++;
			}
			);

//		log("page_names is ("+page_names+")");	// log:0
	} // do not import content pages

	for(var i=0;i<var_names.length;i++) {
		if (var_names[i] == "main_page_")
			new_main_page = (old_version!=2) ? unescape(var_values[i]) : var_values[i];
		else if (var_names[i] == "permit_edits")
			old_block_edits = (var_values[i]=="0");
	}

}	else {	// we are importing a v0.9.x Beta

	// locate the random marker
	try {
		var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/)[1];
	} catch (e) {
		alert("Marker not found!");
		document.body.style.cursor= "auto";
		return false;
	}

	if (import_css) {
		// import the CSS head tag
		var css = null;
		ct.replace(/<style\s.*?type="?text\/css"?[^>]*>((\n|.)*?)<\/style>/i, function (str, $1) {
			css = $1;
		});
		if (css!=null) {
			log("Imported "+css.length+" bytes of CSS");	// log:1
			this.setCSS(css);
		}
	}

	var data = _get_data(old_marker, ct, true, true);
	var collected = [];

	// for versions before v0.9.2B
	if (old_version < 92) {
		collected = get_import_vars(data);
		data = ct = null;

		var has_last_page_flag = (collected.length==14) ? 1 : 0;
		if (!has_last_page_flag && (collected.length!=13)) {
			alert("Invalid collected data!");
			document.body.style.cursor= "auto";
			return false;
		}

		old_block_edits = !collected[2];

		this.config.dblclick_edit = collected[3];

		this.config.save_on_quit = collected[4];

		if (has_last_page_flag)
			this.config.open_last_page = collected[5];
		this.config.allow_diff = collected[5+has_last_page_flag];

		this.config.key_cache = collected[6+has_last_page_flag];

		new_main_page = collected[8+has_last_page_flag];

		page_names = collected[10+has_last_page_flag];

		old_page_attrs = collected[11+has_last_page_flag];

		page_contents = collected[12+has_last_page_flag];

	} else {	// we are importing from v0.9.2 and above which has a config object for all the config flags

		// old-style import for content, skipping the main woas object and the marker
		// shared with v0.9.5B
		collected = get_import_vars(data, new Array('woas', '__marker', 'version', '__config'));

		//0:sw_import_current,1:sw_import_main_page,
		//2:sw_import_backstack,3:sw_import_page_titles,4:sw_import_page_attrs,5:sw_import_pages
		new_main_page = collected[1];
		if (import_content) {
			page_contents = collected[5];
			page_names = collected[3];
			old_page_attrs = collected[4];
			if (old_version==92) {
				// replace the pre tags with the new nowiki syntax
				for(var i=0;i<page_contents.length;i++) {
					// page is encrypted, leave it as is
					if (old_page_attrs[i] & 2)
						continue;
					// ignore special pages
					if (page_names[i].indexOf("Special::")===0)
						continue;
					page_contents[i] = page_contents[i].replace(/<pre(.*?)>((.|\n)*?)<\/pre>/g,
									function (str, $1, $2) {
										var s="{{{"+$2+"}}}";
										if ($1.length)
											s = "<span"+$1+">"+s+"</span>";
										return s;
									});
				}
				// done pre tags fixing
			} // v0.9.2 only
		} // do not import content pages

		// since version v0.9.5B+ we have an object oriented WoaS
		if (old_version >= 95) {
			// rename the members
			collected = [];
			data = data.replace(/([^\\])\nwoas\\["(\w+)"\\] = /g, function (str, $1, $2) {
				collected.push($2);
				return $1+"\ni__woas[\""+$2+"\"] = ";
			});//.replace(/\\\n/g, '');
			data = null;

			// retrieve the object containing all woas data & config
			var i__woas = eval(data+"\ni__woas");

			// import each member
			for(var a=0;a<collected.length;a++) {
				woas[collected[a]] = i__woas[collected[a]];
			}

			if (import_icons) {
				//TODO: import the icons
			} ct = null;

			i__woas = null;
		} else data=null;
		// DO NOT delete the arrays! They're referenced
//		collected = null;
	} // done importing from v0.9.2B+
}

	// this is the common import procedure
	if (import_content) {
		// add new data
		var pages_imported = 0;
		for(var i=0; i<page_names.length; i++) {
			// we are not using is_reserved() because will create chaos in case of edit_override
			if (page_names[i].indexOf("Special::")===0) {
				if (old_version>=94) {
					if (page_names[i]=="Special::Bootscript") {
						pi = this.page_index("WoaS::Bootscript");
						pages[pi] = page_contents[i];
						page_attrs[pi] = 4;
						pages_imported++;
						continue;
					}
				}
				// skip special pages
			} else { // not importing a special page
				pi = this.page_index(page_names[i]);
				if (pi == -1) {
					page_titles.push(page_names[i]);
					pages.push(page_contents[i]);
					page_attrs.push( old_page_attrs[i] );
				} else {
					log("replacing "+page_names[i]);
					if (old_version==94) {
						// convert embedded files to base64 encoding
						if (old_page_attrs[i] & 4) {
							// plain copy images, which were already b64-encoded
							if (old_page_attrs[i] & 8)
								pages[pi] = page_contents[i];
							else {
								// page is encrypted, skip it
								if (old_page_attrs[i] & 2)
									continue;
							}
							pages[pi] = encode64(page_contents[i]);
						}
					} else {
						page_titles[pi] = page_names[i];
						pages[pi] = page_contents[i];
					}
					page_attrs[pi] = old_page_attrs[i];
				}
				pages_imported++;
			} // not importing a special page
		} // for cycle
	} // do not import content pages

	// apply the new main page if that page exists
	if (this.page_exists(new_main_page))
		main_page = new_main_page;

	this.config.permit_edits = !old_block_edits;

	// remove hourglass
	document.body.style.cursor= "auto";

	alert("Import completed: " + pages_imported +"/"+page_names.length.toString()+" pages imported.");

	// move to main page
	current = main_page;
	// save everything
	this.save_to_file(true);

	this.refresh_menu_area();
	this.set_current(main_page, true);
}
