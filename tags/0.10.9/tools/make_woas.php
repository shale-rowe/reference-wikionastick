<?php
## WoaS compiler
# @author legolas558
# @copyright GNU/GPL license
# @version 1.1
# 
# run 'php -q make_woas.php woas.htm' to create a single-file version
# from the multiple files version
# additional understood pameters are:
# 
# woas=path/woas.htm		path to WoaS HTML file - defaults to woas.htm
# log=[0|1|2]		0 - fully disable log, 1 - keep logging as is, 2 - enable all log lines
# native_wsif=[0|1]	specify 1 to enable native WSIF saving, default is 0
# edit_override=[0|1]	specify 1 to enable the edit override
#

$woas = null;
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
				echo $v." is not a valid file\n";
				continue 2;
			}
			$woas = $v;
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

if (!file_exists($woas)) {
	fprintf("File \"%s\" does not exist\n", $woas);
	exit(-1);
}

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
	echo "Could not find any script tag to replace\n";
	exit(-3);
}

$custom_options = "woas.tweak.edit_override = ".($edit_override ? 'true' : 'false').";\n".
			"woas.native_wsif = ".($native_wsif ? 'true' : 'false').";\n";

$ct = substr_replace($ct, $tail.mkscript($custom_options, "Custom options"), $p, $ep-$p);

file_put_contents('woas-single-file.htm', $ct);

echo "WoaS merged into single file woas-single-file.htm\n";

exit(0);

?>
