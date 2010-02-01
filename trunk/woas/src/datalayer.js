// this file contains API for the data layer abstraction

// save all pages
woas["full_commit"] = function() {
	return this._save_to_file(true);
}

woas["cfg_commit"] = function() {
	return this._save_to_file(false);
}

// arguments is a list of page indexes which need to be saved
woas["commit"] = function() {
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
}
