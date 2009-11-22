#!/usr/bin/perl
#use JavaScript::Packer;

my $size = 0;
my $compressed_size = 0;
my $totalsize = 0;
my $bytes_saved = 0;


my $woas = shift || 'woas.htm';
crash(-1, "Consumed with anger because woas hml file '$woas' does not exist!") if (! -f $woas);
my $ct = slurp($woas);

crash(-2, "Could not find marker\n") unless ($ct =~ /\nvar __marker = "([^"]+)";/ );
my $marker = $1;

$p = index($ct, '/* '.$marker.'-END */', 0);
$ep = index($ct, '</head>', $p);

my $tail = substr($ct, $p, $ep-$p);

$base_dir = dirname($woas).'/';

my $replaced = 0;

$tail =~ s`<script src="([^"]+)" type="text/javascript"></script>`&script_replace($1)`gems;

crash(-3, "Could not find any script tag to replace\n".$tail) unless($replaced);

substr($ct, $p, $ep-$p, $tail);

file_put_contents('woas-merged.htm', $ct);

print "WoaS merged into single file woas-merged.htm " . length($ct) .  " bytes (saved  $bytes_saved bytes)\n";

exit 0;

sub slurp {
	my ($filename, $default)=@_;
	return 0 unless( $filename && -f $filename);
	open(PLATE, $filename) or crash(2, "Error opening '$filename'");
	my $slash = $/;
	undef $/;
	$spaguetti = <PLATE>;
	$/ = $slash;
	return $spaguetti;
}

sub crash{
	my($errorcode, $errormessage) = @_;
	$! = $errorcode;
	@C = caller();
	die "@C: " . $errormessage . "\n";
}

sub dirname{
	$_ = shift;
	s`\\`/`g;
	return $_ if(s`/[^/]*``);
	return '.';
}

sub basename{
	$_ = shift;
	s`\\`/`g;
	return $_ if(s`^.*/``);
	return '.';
}

sub script_replace {
	my($t) = @_;
	my $jsm = "$base_dir/$t";
	crash($replaced, "Could not locate '$jsm'") unless(-f $jsm);
	my $ct = slurp($jsm);
	# remove BOM if present
	my $BOM = sprintf ("\\x%X\\x%X\\x%X/A", 239, 187, 191);
	$ct =~ s/$BOM//;
	$size = length($ct);
	#JavaScript::Packer::minify( \$ct, { 'compress' => 'clean' } );
	#$ct = `perl jsjam.pl -g -i -n -b< $jsm`;
	$ct = Squeeze($ct);
	$compressed_size = length($ct);
	if(!$compressed_size || $?){
		$compressed_size = length($ct = slurp($jsm));
		warn "Could not compress $jsm ". ($??$!:'') ."\n";
	}
	$bytes_saved += $size - $compressed_size;
	print "Injecting $jsm: $size ".($size - $compressed_size>0?'->':'=')." $compressed_size\n";
	
	#$ct=~s/\n\n//gm;
	#$ct=~s/^\s*//gs;
	++$replaced;
	return '<script language="javascript" type="text/javascript">'
	."\n/* <![CDATA[ */\n/*** ".basename($jsm)." ***/\n".$ct
	."\n/* ]]> */ </script>";
}

sub file_put_contents {
	my($destination, $content) = @_;
	open(FPC, '>', $destination) or crash("Unable to save to '$destination', $!");
	print FPC $content;
	close(FPC);
}

sub Squeeze{
	$_ = shift;
	return $_ if(grep( /(-nc|--no_compression)/, @ARGV));
	s/^\s+//gm; # remove leading spaces
	s/\s+$//gm; # remove trailing spaces
	s`//\s+.*$``gm; # remove trailing comments (tries to)
	s`^\s*//.*$``gm; # remove full line comments
	s%\s*\n{%{%gm;
	s%\s*\n({|})%$1%gm;
	#s%;\n(?!else)%;%gm;
	s%{\n%{%gm;
	s%(if|function|while|do)\s*\(%$1(%gm;
	s`(try)\s+\{`$1\{`gm;
	s`\s+(\+=|\!=|==)\s+`$1`gm;
	s`\s*=\s*(function|true|false|new|null|document|\$\(")`=$1`gm;
	s`(data|innerHTML|cursor|fname|current|woas|pages?|tmp|pos|ility|_menu|var\s+\w+|stack|title|text|\]|edits|wiki|tags?|img|hash|enc\d)\s*=\s*`$1=`gm;
	s`\n\n+`\n`gm;
	s`",\s+"`","`gm; # remove spaces between array elements
	s`^/\*.*?^\*/``gms; # multiline comments (certain type)
	s%(\.,\+)\n%$1%gms; # join concatenate
	s%\n(\.,\+)%$1%gms; # join concatenate
	s%;\n(return)%;$1%gms; #
	#s%(?<!\n)else%\nelse%gms;
	s`function\(([^)]+)\)\s*`"function(".&stripspace($1).")"`egm;
	s`function\s+(\w+)\s*\(([^)]+)\)\s*`"function ".$1."(".&stripspace($2).")"`egm;
	return $_;
}

sub stripspace{
	my $s = shift;
	$s=~s/\s+//g;
	return $s;
}