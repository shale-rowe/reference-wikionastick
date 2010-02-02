// core WoaS, WoaS::UI code

woas["cmd_duplicate_page"] = function() {
	var pname = this._new_page("Insert duplicate page title", true, current+" (duplicate)");
	if (pname == null)
		return;
	var pi = this.page_index(current);
	var dpi = this.page_index(pname);
	// duplicate the page
	pages[dpi] = pages[pi]; // .slice ?
	page_attrs[dpi] = page_attrs[pi];	
	// go to new page
	go_to(pname);
}

woas["cmd_new_page"] = function() {
	this._new_page(this.i18n.INSERT_NEW, false, '');
}

// used to create a new page in the wiki
woas["_new_page"] = function(msg, fill_mode, def_title) {
	var title = def_title;
	do {
		title = prompt(msg, title);
		if (title == null) break;
		if (!title.match(/\[\[/) && !title.match(/\]\]/))
			break;
		this.alert(this.i18n.BRACKETS_TITLE);
	} while (1);
	if ((title!=null) && title.length) {
		if (this.page_index(title)!=-1)
			this.alert(this.i18n.PAGE_EXIST.sprintf(title));
		else {
			cr = title;
			if (cr.substring(cr.length-2)=="::") {
				this.alert(this.i18n.ERR_PAGE_NS);
			} else {
				var p = cr.indexOf("::");
				if (p!=-1) {
					ns = cr.substring(0,p);
//					log("namespace of "+cr+" is "+ns);	// log:0
					cr = cr.substring(p+2);
				} else ns="";
				if (!this._create_page(ns, cr, false, fill_mode))
					return ns+cr;
				var upd_menu = (cr=='Menu');
				if (!upd_menu && confirm(this.i18n.ASK_MENU_LINK)) {
					var menu = this.get_text("::Menu");
					var p = menu.indexOf("\n\n");
					if (p==-1)
						menu += "\n[["+ns+cr+"]]";
					else
						menu = menu.substring(0,p)+"\n[["+title+"]]"+menu.substring(p);
					this.set__text(this.page_index("::Menu"), menu);
					upd_menu = true;
				}
				if (upd_menu)
					this.refresh_menu_area();
				return ns+cr;
			}
		}
	}
	return null;
}

woas["cmd_erase_wiki"] = function() {
	if (this.erase_wiki()) {
		this.full_commit();
		back_or(main_page);
	}
	return null;
}

// pages which shall never be modified
woas["static_pages"] = ["Special::About", "Special::Advanced", "Special::Options","Special::Import",
						"Special::Lock","Special::Search","Special::Security", "Special::Embed",
						"Special::Export", "Special::License", "Special::ExportWSIF",
						"Special::WSIF", "Special::ImportWSIF" ];

woas["default_pages"] = ["Main Page", "::Menu", "WoaS::Bootscript", "WoaS::Aliases"];

woas["erase_wiki"] = function() {
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return false;
	}
	if (!confirm(this.i18n.CONFIRM_DELETE_ALL1) &&
		!confirm(this.i18n.CONFIRM_DELETE_ALL2))
		return false;
	var backup_pages = [];
	// attributes and last modified timestamps for default pages
	page_attrs = [0, 0, 4, 0];
	page_mts = [this.MAGIC_MTS, this.MAGIC_MTS, this.MAGIC_MTS, this.MAGIC_MTS];
	// now pick the static pages
	for(var i=0;i<this.static_pages.length;i++) {
		var pi = this.page_index(this.static_pages[i]);
		if (pi==-1) {
			this.alert(this.i18n.STATIC_NOT_FOUND.sprintf(static_pg[i]));
			return false;
		}
		backup_pages.push(pages[pi]);
		page_attrs.push(0);
		// reset timestamp
		page_mts.push(this.MAGIC_MTS);
	}
	page_titles = this.default_pages.concat(this.static_pages);
	pages = ["This is your empty main page", "[[Main Page]]\n\n[[Special::New Page]]\n[[Special::Duplicate Page]]\n[[Special::Go to]]\n[[Special::Delete Page]]\n[[Special::Backlinks]]\n[[Special::Search]]", encode64("/* insert here your boot script */"), ""];
	pages = pages.concat(backup_pages);
	current = main_page = "Main Page";
	this.refresh_menu_area();
	backstack = [];
	forstack = [];
	return true;
}

woas["cmd_main_page"] = function() {
	go_to(main_page);
	return null;
}

woas["cmd_edit_css"] = function() {
	if (!this.config.permit_edits && !edit_override) {
		this.alert(this.i18n.READ_ONLY);
		return null;
	}
	_servm_alert();
	this.current_editing("Special::Edit CSS", true);
	this.edit_ready(_css_obj().innerHTML);
	return null;
}

woas["cmd_edit_aliases"] = function() {
	return this.cmd_edit_special("WoaS::Aliases", false);
}

woas["cmd_edit_bootscript"] = function() {
	return this.cmd_edit_special("WoaS::Bootscript", true);
}

// used to edit many special pages
woas["cmd_edit_special"] = function(cr, decode) {
	if (!this.config.permit_edits && !edit_override) {
		this.alert(this.i18n.READ_ONLY);
		return null;
	}
	_servm_alert();
	// maybe the following line can be 
	var tmp = this.get_text(cr);
	if (tmp == null)
		return null;
	this.current_editing(cr, true);
	// setup the wiki editor textbox
	this.current_editing(cr, this.config.permit_edits | this._server_mode);
	if (decode)
		this.edit_ready(decode64(tmp));
	else
		this.edit_ready(tmp);
	return null;
}

woas["cmd_go_to"] = function() {
	var pname = prompt("Go to page:", current);
	if ((pname === null) || !pname.length)
		return null;
	go_to(pname);
}

woas["cmd_delete"] = function() {
	var pname = prompt(this.i18n.DELETE_PAGE_PROMPT, current);
	if ((pname === null) || !pname.length)
		return;
	var pi = this.page_index(pname);
	if (pi == -1) {
		this.alert(this.i18n.PAGE_NOT_EXISTS+pname);
		return;
	}
	if ((pname != null) && confirm(this.i18n.CONFIRM_DELETE.sprintf(pname))) {
		delete_page(pname);
		this.save_page(pname);
	}
}

// javascript shortcuts for special pages
woas["shortcuts"] = ["New Page", "Duplicate Page", "All Pages", "Orphaned Pages", "Backlinks", "Dead Pages", "Erase Wiki", "Edit CSS", "Main Page", "Edit Bootscript", "Aliases", "Go to", "Delete Page", "Recentchanges"];
woas["shortcuts_js"] = ["cmd_new_page", "cmd_duplicate_page", "special_all_pages", "special_orphaned_pages", "special_backlinks",
					"special_dead_pages", "cmd_erase_wiki", "cmd_edit_css", "cmd_main_page",
					"cmd_edit_bootscript", "cmd_edit_aliases", "cmd_go_to", "cmd_delete",
					"special_recent_changes"];

// return raw javascript tag to be included in XHTML page
woas["raw_js"] = function(code) {
	return "<scr"+"ipt type=\"text/javascript\">\n"+code+"\n<"+"/s"+"cript>";
}
