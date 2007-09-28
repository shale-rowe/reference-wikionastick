
function import_wiki() {
	var filename = $("filename_").value;
	if(filename == "")
	{
		alert("A file must be selected");
		return false;
	}

	if(confirm("This will OVERWRITE pages with the same title.\n\nAre you sure you want to continue?") == false)
		return false;

	// set hourglass
	document.body.style.cursor= "wait";
	
	var ct = loadFile(filename);
	
	// get version
	var old_version;
	var ver_str = ct.match(/<div .*?id=("version_"|version_).*?>([^<]+)<\/div>/i);
	if (ver_str && ver_str.length>1) {
		ver_str = ver_str[2];
		log("Importing wiki with version string \""+ver_str+"\"");
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
		if (ver_str && ver_str.length) {
			ver_str = ver_str[1];
			log("Version string: "+ver_str);
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
					old_version = 95;
				break;
				default:
					alert("Incompatible version: " + ver_str);
					document.body.style.cursor= "auto";
					return false;
			}
		} else {
			log("Maybe version 0.02?");
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
		
	if(old_version == 2)
	{
		try {
			vars = wiki.match(/\<div .*?id=("main_page"|main_page)>(.*?)\<\/div\>/i)[1];
		} catch(e) {
			log("No variables found");
		}
	}

	// get an array of variables and wikis
	var var_names = [];
	var var_values = [];
	var vc = 0;

	
	// eliminate headers
	wiki = wiki.substring(wiki.indexOf(">")+1);
	vars = vars.substring(vars.indexOf(">")+1);
	
	vars.replace(/<div id="?(version_|main_page_|permit_edits_|[\w_]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2)
			{
				if(old_version == 2)
					var_names[vc] = "main_page_";
				else
					var_names[vc] = $1;
				var_values[vc] = $2;
				vc++;
			});
			
	log("Variables are ("+var_names+")");

	// now extract the pages
	wiki.replace(/<div .*?id="?([^">]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2, $3)
			{
				log("Parsing old page "+$1);
				if (old_version != 2) {
					page_names[pc] = unescape($1);
					page_contents[pc] = unescape($2);
				} else {
					page_names[pc] = $1;
					page_contents[pc] = $2;
				}
				// dismiss special pages
				if (page_names[pc].indexOf("Special::")==0) {
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

	log("page_names is ("+page_names+")");

	for(var i=0;i<var_names.length;i++) {
		if (var_names[i] == "main_page_")
			new_main_page = (this.version!=2) ? unescape(var_values[i]) : var_values[i];
		else if (var_names[i] == "permit_edits")
			old_block_edits = (var_values[i]=="0");
	}
	
	//note: before v0.04 permit_edits didnt exist
	//note: in version 2 pages were not escaped

}	else {	// we are importing a v0.9.x Beta

	// locate the random marker
	try {
		var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/)[1];
	} catch (e) {
		alert("Marker not found!");
		document.body.style.cursor= "auto";
		return false;
	}

	// import the CSS head tag
	var css = null;
	ct.replace(/<style\s.*?type="?text\/css"?[^>]*>((\n|.)*?)<\/style>/i, function (str, $1) {
		css = $1;
	});
	if (css!=null) {
		log("Imported "+css.length+" bytes of CSS");
		this.setHTML(_css_obj(), css);
	}

	var data = _get_data(old_marker, ct, true, true);
	var collected = [];

	if (old_version < 92) {
		
		// rename the variables
		data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
			collected.push('sw_import_'+$2);
			return $1+"\nvar sw_import_"+$2+" = ";
		});//.replace(/\\\n/g, '');
		
		log("collected config variables = "+collected);
		
		collected = eval(data+"\n["+collected+"];");
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
		// from version v0.9.5B+ we have an object oriented WoaS
		if (old_version >= 95) {
			alert("Import from version 0.9.5B not yet supported!");
			return false;
			// rename the members
			data = data.replace(/([^\\])\nwoas\\["(\w+)"\\] = /g, function (str, $1, $2) {
				collected.push($2);
				return $1+"\ni__woas[\""+$2+"\"] = ";
			});//.replace(/\\\n/g, '');
			
			// retrieve the object containing all woas data & config
			var i__woas = eval(data+"\ni__woas");
			data = ct = null;
			
			// import everything as is
			for(var a=0;a<collected.length;a++) {
				woas[collected[a]] = i__woas[collected[a]];
			}

			i__woas = null;
		} else { // for versions 0.9.2, 0.9.3, 0.9.4
			
			old_page_attrs = sw_import_page_attrs;
			
			page_contents = sw_import_pages;
			
			// replace the pre tags with the new nowiki syntax
			if (old_version==92) {
				for(var i=0;i<page_contents.length;i++) {
					// page is encrypted, leave it as is
					if (this.is__encrypted(i))
						continue;
					page_contents[i] = page_contents[i].replace(/<pre(.*?)>((.|\n)*?)<\/pre>/g,
									function (str, $1, $2) {
										var s="{{{"+$2+"}}}";
										if ($1.length)
											s = "<span"+$1+">"+s+"</span>";
										return s;
									});
				}
			}
		} // end of v0.9.2 and above import
		collected = null;
	}
}

	// add new data
	var pages_imported = 0;
	for(var i=0; i<page_names.length; i++)
	{
		if ( !this.is_reserved(page_names[i]))
		{
			pi = page_titles.indexOf(page_names[i]);
			if (pi == -1) {
				page_titles.push(page_names[i]);
				pages.push(page_contents[i]);
				page_attrs.push( old_page_attrs[i] );
			} else {
				page_titles[pi] = page_names[i];
				if (old_version==94) {
					// convert embedded files to base64 encoding
					if (old_page_attrs[i] & 4)
						pages[pi] = page_contents[i];
					else
						pages[pi] = encode64(page_contents[i]);
				} else
					pages[pi] = page_contents[i];
				page_attrs[pi] = old_page_attrs[i];
			}
			pages_imported++;
		} else { // special pages
			if (old_version==94) {
				if (page_names[i]=="Special::Bootscript") {
					page_titles.push("Special::Bootscript");
					pages.push(page_contents[i]);
					page_attrs.push(4);
				}
			}
		}
	}
	
	if (this.page_exists(new_main_page))
		main_page = new_main_page;

	this.config.permit_edits = !old_block_edits;

	// remove hourglass
	document.body.style.cursor= "auto";
	
	alert("Import completed: " + pages_imported + " pages imported.");
	
	current = main_page;
	// save everything
	save_to_file(true);
	
	this.refresh_menu_area();
	this.set_current(main_page);
}
