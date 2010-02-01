// this file contains API for the data layer abstraction

// save all pages
woas["full_commit"] = function() {
	return this._save_to_file(true);
}

woas["cfg_commit"] = function() {
	return this._save_to_file(false);
}

// arguments is a list of page indexes which need to be saved
woas["commit"] = function(plist) {
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
}

woas["after_pages_saved"] = function(plist) {
	// we assume that everything was saved
	if (typeof plist == "undefined") {
		this.save_queue = [];
		return;
	}
	// we remove each of the saved pages from queue (needs TESTING!)
	for(var i=0,l=plist.length;i<l;i++) {
		var p = this.save_queue.indexOf(plist[i]);
		if (p != -1)
			this.save_queue = this.save_queue.slice(0,p).concat(this.save_queue.slice(p+1));
	}
}

// event called when the config was successfully saved
woas["after_config_saved"] = function() {
	cfg_changed = false;
}
