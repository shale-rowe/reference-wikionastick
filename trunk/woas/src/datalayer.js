// this file contains API for the data layer abstraction

// save all pages
woas["full_commit"] = function() {
	var r = this._save_to_file(true);
	// save was successful
	if (r) {
		cfg_changed = false;
		this.floating_pages = [];
	}
	return r;
}

woas["cfg_commit"] = function() {
	var r = this._save_to_file(false);
	if (r)
		cfg_changed = false;
}

// arguments is a list of page indexes which need to be saved
woas["commit"] = function() {
	// performs full save, while the single page + global header could be saved instead
	var r = this._save_to_file(true);
	// save was successful
	if (r) {
		cfg_changed = false;
		this.floating_pages = [];
	}
	return r;
}
