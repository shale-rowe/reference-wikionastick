#!/usr/bin/php -q
<?php
## WoaS compiler
# @author legolas558
# @copyright GNU/GPL license
# @version 1.3.0
# 
# run 'mkwoas.php woas.htm' to create a single-file version
# from the multiple files version
# additional understood pameters are:
# 
# woas=path/woas.htm		path to WoaS HTML file - defaults to woas.htm
# wsif=path/index.wsif		path to pages data in WSIF format
# log=[0|1|2]		0 - fully disable log, 1 - keep logging as is, 2 - enable all log lines
# native_wsif=[0|1]	specify 1 to enable native WSIF saving, default is 0
# edit_override=[0|1]	specify 1 to enable the edit override
#

$woas = $wsif = null;
$log = $edit_override = $native_wsif = false;

// parse the command line parameters
for($i=1;$i<$argc;++$i) {
	$a=explode('=', $argv[$i],2);
	if (count($a)!=2 || !strlen($a[1])) {
		echo "Invalid parameter: ".$argv[$i]."\n";
		continue;
	}
	$v=$a[1];
	switch ($a[0]) {
		case 'woas':
			if (!is_file($v)) {
				fprintf(STDERR,"%s is not a valid file\n", $v);
				continue 2;
			}
			$woas = $v;
			break;
		case 'wsif':
			if (!is_file($v)) {
				fprintf(STDERR,"%s is not a valid file\n", $v);
				continue 2;
			}
			$wsif = $v;
			break;
		case 'log':
			$log = $v?1:0;
			break;
		case 'edit_override':
			$edit_override = $v?1:0;
			break;
		case 'native_wsif':
			$edit_override = $v?1:0;
			break;
		default:
			fprintf(STDERR, "Parameter \"%s\" is not recognized\n", $a[0]);
	}
}

// default path
if (!isset($woas))
	$woas = 'woas.htm';
if (!isset($wsif))
	$wsif = 'index.wsif';

$ct = file_get_contents($woas);

if (!preg_match('/\\nvar __marker = "([^"]+)";/', $ct, $m)) {
	fprintf(STDERR, "Could not find marker\n");
	exit(-2);
}

$marker = $m[1];
// locate marker end
$p=strpos($ct, '/* '.$marker.'-END */');
$ep = strpos($ct, '</head>', $p);

$tail = substr($ct, $p, $ep-$p);

global $replaced, $base_dir;
$replaced=0;
$base_dir = dirname($woas).'/';
function _script_replace($m) {
	global $replaced, $base_dir;
	if (!file_exists($base_dir.$m[1])) {
		fprintf(STDERR, "Could not locate $base_dir".$m[1]."\n");
		return $m[0];
	}
	$ct = file_get_contents($base_dir.$m[1]);
	// remove BOM if present
	$ct = preg_replace('/\\x'.dechex(239).'\\x'.dechex(187).'\\x'.dechex(191).'/A', '', $ct);
	//TODO: apply modifications now
	++$replaced;
	echo "Replaced ".$m[1]."\n";
	return mkscript($ct, basename($m[1]));
}

function mkscript($ct, $desc = "") {
	return '<script language="javascript" type="text/javascript">'.
		"\n/* <![CDATA[ */\n".(strlen($desc) ? "/*** ".$desc." ***/\n" : "")
		.$ct."\n/* ]]> */ </script>";
}

$tail = preg_replace_callback('/<script src=\"([^"]+)" type="text\\/javascript"><\\/script>/', '_script_replace', $tail);

if (!$replaced) {
	fprintf(STDERR, "ERROR: cannot find any external script to replace\n");
	exit(-3);
}

// apply the custom settings
$tail = preg_replace_callback("/woas\\[\"tweak\"\\]\\s*=\\s*\\{([^;]+);/s", '_replace_tweak_vars', $tail);

function _replace_tweak_vars($m) {
	return "woas[\"tweak\"] = {".
		preg_replace_callback('/"([^"]+)"\\s*:\\s*(true|false)/', '_replace_tweak_vars_single', $m[1]).
		";";
}

function _replace_tweak_vars_single($m) {
	$var = $m[1];
	switch ($var) {
		case 'edit_override':
			$v = $GLOBALS['edit_override'];
		break;
		case 'native_wsif':
			$v = $GLOBALS['native_wsif'];
		break;
		case 'integrity_test':
			// always disable the integrity test
			$v = false;
	}
	return '"'.$var.'": '.($v ? 'true' : 'false');
}

$ct = substr_replace($ct, $tail, $p, $ep-$p);

// get the native pages data and convert them to javascript array data
require dirname(__FILE__).'/libwsif.php';

global $pages, $page_title,$page_attrs, $page_mts;
$pages = $page_attrs = $page_titles = $page_mts = "";

function _print_n($n, &$s) {
	if ($n>=1000)
		$s.="0x".dechex($n);
	else
		$s.=sprintf("%d", $n);
	$s .= ",";
}

function _js_encode(&$WSIF, $s, $split_lines = false) {
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if ($split_lines)
		$nl = "\\n\\\n";
	else
		$nl = "\\n";
	$s = str_replace(array("<", ">", "\r\n", "\n", "'"), array("\\x3C", "\\x3E", $nl, $nl, "\\'"),
			str_replace("\\", "\\\\", $s));
	return $WSIF->utf8_js($s);
}

function _print_mixed(&$WSIF, &$page, $attrs, &$pages) {
	// embedded page e.g. byte array
	if ($attrs & 2) {
		$s="[";
		$l=count($e);
		for($i=0;$i<$l-1;++$i) {
			_print_n($e[$i], $s);
		}
		// print the last element
		if ($l>1) {
			if ($n>=1000)
				$s.="0x".dechex($e[$l-1]);
			else
				$s.=sprintf("%d", $e[$l-1]);
		}
		$s.="]";
		// save encoded page
	} else
		$s = "'"._js_encode($WSIF, $page, true)."'";
	
	$pages .= $s.",\n";
}

function _WSIF_get_page(&$WSIF, $title, &$page, $attrs, $mts) {
	global $pages, $page_titles, $page_attrs, $page_mts;
	// store attributes
	_print_n($attrs, $page_attrs);
	// store timestamp
	_print_n($mts, $page_mts);
	// store title
	$page_titles .= "'"._js_encode($WSIF, $title)."',\n";
	// store page data
	_print_mixed($WSIF, $page, $attrs, $pages);
	// all OK
	return 0;
}

$WSIF = new WSIF();
if (false === $WSIF->Load($wsif, '_WSIF_get_page'))
	exit(-19);

// put the data in the woas.htm file
$ct = preg_replace_callback("/\nvar (page[^ ]+) = \\[(.*?)\\];/s", '_inline_vars_rep', $ct);
unset($WSIF);

function _inline_vars_rep($m) {
	$var = $m[1];
	if (!isset($GLOBALS[$var]))
		return $m[0];
	$addnl = '';
	switch($var) {
		case 'page_mts':
		case 'page_attrs':
			$ofs = -1;
		break;
		case 'page_titles':
			$addnl = "\n";
			// fallback wanted
		default:
			$ofs = -2;
	}
	$r = "\nvar ".$var." = [".$m[2].substr($GLOBALS[$var], 0, $ofs).$addnl."];";
	unset($GLOBALS[$var]);
	return $r;
}

// get the version string
if (!preg_match("/^var\\s+woas\\s*=\\s*\\{\\s*\"version\"\\s*:\\s*\"([^\"]+)\"\\s*\\}/m", $ct, $ver)) {
	fprintf(STDERR, "ERROR: cannot find WoaS version\n");
	exit(-4);
}

$ver = $ver[1];

$ofile = 'woas-'.$ver.'.htm';
if (file_put_contents($ofile, $ct))
	fprintf(STDOUT, "WoaS v%s merged into %s\n", $ver, $ofile);
else
	exit(-1);

exit(0);

?>
