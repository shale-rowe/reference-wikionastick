/*
 *  API for the data layer abstraction
*/

// locks read from datasource files or set by us
woas.locks = {
	// hashmap with a lock entry for each active filename
	datasources : {},
	
	_reset : function() {
		// clear object
		this.datasources = {};
		//TODO: add one entry for each expected datasource
	},
	
	_generate_magic_lock : function() {
		return _random_string(10);
	},
	
	_load_locks : function() {
		var lck_file = woas.ROOT_DIRECTORY + woas.config.wsif_ds + ".lock";
		// attempt reading the lock file index
		var lock_data = woas.load_file(lck_file);
		// fail in case of no loading API available
		if (lock_data === null)
			return false;
		var need_save = false;
		// the lock file does not exist, it's time to initialize it
		if (lock_data === false) {
			this._reset();
			// we will write the file
			need_save = true;
		} else {
			// check that
		}
		return true;
	},
	
	_update_locks : function() {
		//TODO: write the lock file index
		return true;
	},
	
	is_locked : function(filename) {
		// if lock is not defined, it is not active of course
		if (typeof this.datasources[filename] == "undefined")
			return false;
		return this.datasources[filename].active;
	},
	
	// called when editing some page which modifies one or more datasources
	// returns true if lock could be held successfully
	hold : function(filename, whom) {
		// (1) each time there is an attempt to lock/unlock something we read the lock file index
		// and check if the datasource has been locked or if there have been changes to some lock
		if (!this._load_locks())
			return false;
		
		// (2) is this file already locked?
		if (this.is_locked(filename)) {
			var lock = this.datasources[filename];
			if (!confirm("%s was locked by %s at %s.\nDo you want to ignore this lock?\n\nWARNING: PRESS OK ONLY IF NOBODY ELSE IS EDITING".
						sprintf(filename, lock.owner, lock.when.toLocaleString()
						)))
				return false;
			// otherwise ignore lock
			lock = null;
		}
		
		// (3) re-create the lock
		this.datasources[filename] = {
			magic : this._generate_magic_lock(),		// magic is used to compare two locks
			owner : whom,								// author of locking
			when : new Date(),							// when locking happened
			active : true
		};
		
		// update the lock index
		return this._update_locks();
	},
	
	release : function(filename) {
		// (1) each time there is an attempt to lock/unlock something we read the lock file index
		// and check if the datasource has been locked or if there have been changes to some lock
		if (!this._load_locks())
			return false;
		// (2) check if datasource is actually locked
		if (typeof this.datasources[filename] == "undefined") {
//			log("BUG: NO LOCK exists for "+filename);	//log:0
			return false;
		}
		// unactive the lock object (but keep it to check if file was modified)
		this.datasources[filename].active = false;
		// update the lock index
		return this._update_locks();
	}
};

woas._wsif_ds_save = function(subpath, plist) {
	// if we have a native sub-path, trigger the WSIF datasource save
	if (subpath.length === 0)
		return;
	// always save in the root directory
	// code disabled since we always save the full backup
//	if (typeof plist != "undefined" )
//		done = this._native_wsif_save(path,	subpath, true, true, "", true, plist); else
	this._native_wsif_save(woas.ROOT_DIRECTORY, subpath, this.config.wsif_ds_lock,
							!this.config.wsif_ds_multi,	!this.config.wsif_ds_multi,
							this.config.wsif_author, true);
};

//API1.0: save all pages
woas.full_commit = function() {
	this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock);
	return this._save_to_file(true);
};

//API1.0: save WoaS configuration
woas.cfg_commit = function() {
	if (this.config.wsif_ds.length !== this._old_wsif_ds_len)
		this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock);
	return this._save_to_file(false);
};

//API1.0: save specific list of pages
// plist is a list of page indexes which need to be saved
woas.commit = function(plist) {
	this._wsif_ds_save(this.config.wsif_ds, this.config.wsif_ds_lock, plist);
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
};

//API1.0: delete specific list of pages
// plist is a list of page indexes which need to be saved (not allowed to be empty)
woas.commit_delete = function(plist) {
	// update only the native WSIF index (leaves back deleted pages)
	this._native_save(this.config.wsif_ds, []);
	// performs full save, while the single page + global header could be saved instead
	return this._save_to_file(true);
};

//API1.0: event called after some page is being saved
// plist can be undefined if all pages were saved
woas.after_pages_saved = function(plist) {
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
};

//API1.0: event called when the config was successfully saved
woas.after_config_saved = function() {
	cfg_changed = false;
};
