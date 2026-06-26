# picard — Picard tools for SAM/BAM processing

**GitHub:** https://github.com/broadinstitute/picard
**Category:** variant
**Language:** Java
**Stars:** 1,066
**Topics:** 
**Description:** A set of command line tools (in Java) for manipulating high-throughput sequencing (HTS) data and formats such as SAM/BAM/CRAM and VCF.


---

## README

***User Support:***


For user questions please look for answers and ask first in the [GATK forum](https://gatk.broadinstitute.org/hc/en-us/community/topics).


----


[![Build Status](https://github.com/broadinstitute/picard/actions/workflows/tests.yml/badge.svg?branch=master)](https://github.com/broadinstitute/picard/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/broadinstitute/picard/blob/master/LICENSE.txt)

A set of Java command line tools for manipulating high-throughput sequencing (HTS) data and formats.  

Picard is implemented using the HTSJDK Java library [HTSJDK][1] to support
accessing file formats that are commonly used for high-throughput
sequencing data such as [SAM][2] and [VCF][3].  

As of version 3.0, Picard requires Java 1.17.

#### Building Picard

* First, clone the repo:
```
    git clone https://github.com/broadinstitute/picard.git
    cd picard/
```

* Picard is now built using [gradle](https://gradle.org/). A wrapper script (`gradlew`) is included which will download the appropriate version of gradle on the first invocation.
    
* To build a fully-packaged, runnable Picard jar with all dependencies included, run:
```
    ./gradlew shadowJar
```

* The resulting jar will be in `build/libs`. To run it, the command is:
```
    java -jar build/libs/picard.jar
    
    or
    
    java -jar build/libs/picard-<VERSION>-all.jar 
```    

    
* To build a jar containing only Picard classes (without its dependencies), run:
```
    ./gradlew jar
```    
    
* To clean the build directory, run:
```
    ./gradlew clean
```

#### Running Tests

* To run all tests, the command is:
```
    ./gradlew test
```

* To run a specific test, the command is:
```
    ./gradlew legacyTest --tests "*TestClassName*"
    
    or
    
    ./gradlew barclayTest --tests "*TestClassName*"
```
Running `legacyTest` uses the legacy commandline parser while `barclayTest` uses the new parser.  



#### Changing the released version of HTSJDK that Picard depends on

To switch Picard's HTSJDK dependency to a different released version:

* Open `build.gradle`
* Edit VERSION in the following line to be a different released version of HTSJDK. HTSJDK releases are listed [here](https://github.com/samtools/htsjdk/releases)
```
    final htsjdkVersion = System.getProperty('htsjdk.version', 'VERSION')`
```
* Open a pull request with this change

#### Building Picard with a Custom Version of HTSJDK

During development in Picard, it is sometimes necessary to build locally against an unreleased version or branch of HTSJDK. 

* To build against an unreleased version of HTSJDK's master branch:
    * Go to the [Broad artifactory](https://artifactory.broadinstitute.org/artifactory/simple/libs-snapshot-local/com/github/samtools/htsjdk/), where continuous snapshots of HTSJDK's master branch are published, and select the version you want to use. For example, `2.5.1-9-g5740ca1-SNAPSHOT`. You can search by tag or short git commit hash.
    * In your Picard clone, run `./gradlew shadowJar -Dhtsjdk.version=VERSION`, where VERSION is the version of the HTSJDK master branch snapshot you want to use.
    
* To build against a version of HTSJDK that has *not* yet been merged into HTSJDK's master branch:
    * Clone [HTSJDK](https://github.com/samtools/htsjdk/), and in your clone check out the tag or branch you want to build Picard with.
    * Run `./gradlew install printVersion` in your htsjdk clone to install that version to your local maven repository. Take note of the version number that gets printed at the end.
    * Switch back to your Picard clone, and run `./gradlew shadowJar -Dhtsjdk.version=VERSION`, where VERSION is the version of HTSJDK you installed to your local maven repository.

#### Releasing Picard

Full instructions on how to create a new release of 
Picard are [here](https://github.com/broadinstitute/picard/wiki/How-to-release-Picard)

#### Path providers

Picard has limit
…[truncated]

---

## Common Issues & Discussions (top closed issues by comments)

- [12 comments] **Improved documentation for Picard tools**
  Added usage examples and provided detailed explanations for metrics.


- [23 comments] **UMI Aware Mark Duplicates with rudimentary error correction**
  @yfarjoun @nh13 If one of you could review this, that would be great!


- [9 comments] **new CLP: CollectSamErrorMetric**
  This contains a new CLP which collects base error information on a sam/bam file based on various covariates.

There are two error types (simple and overlapping bases) and many many covariates that c

- [3 comments] **GtcToVcf a tool to convert Illumina GTC files to VCF format**
  ### Description

A tool to convert Illumina GTC files to VCF format

----

### Checklist (never delete this)

Never delete this, it is our record that procedure was followed. If you find that 

- [17 comments] **Enable use of cloud reference files**
   ...by updating the ReferenceArgumentCollection implementations to use nio paths.

(Edited by tsato on 8/14/23)

This PR updates `ReferenceArgumentCollection` and classes that implement it to supp