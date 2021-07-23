#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const intputPath = process.argv[2] || '';

const arcJSONPathSuffix = '.arc/Json/isa.investigation.json';
const root = path.isAbsolute(intputPath) ? intputPath : `${process.cwd()}/${intputPath}`;

console.log(`Generating 'ro-crate-metadata.json' file for '${root}' `);

const arcJSONPath = root+'/'+arcJSONPathSuffix;
if( !fs.existsSync(arcJSONPath) ){
  console.error(`Directory '${root}' contains no '${arcJSONPathSuffix}' file.`);
  process.exit();
}

const arcJSON = JSON.parse(fs.readFileSync(arcJSONPath));

const roc = {
  '@context': 'https://w3id.org/ro/crate/1.1/context',
  '@graph': {

    'ro-crate-metadata.json' : {
        '@type': 'CreativeWork',
        '@id': 'ro-crate-metadata.json',
        'conformsTo': {'@id': 'https://w3id.org/ro/crate/1.1'},
        'about': {'@id': './'},
        'description': 'RO-Crate Metadata File Descriptor'
    },

    './' : {
      '@id': './',
      '@type': 'Dataset',
      'author': [],
      'citation': [],
      'hasPart': [
        {
          '@id': 'assays/'
        }
      ]
    },

    'assays/' : {
      'name': 'assays',
      '@id': 'assays/',
      '@type': 'Dataset',
      'hasPart': []
    }
  }
};

// Note that all @id identifiers must be valid URI references, care must be taken to express any relative paths using / separator, correct casing, and escape special characters like space (%20) and percent (%25), for instance a File Data Entity from the Windows path Results and Diagrams\almost-50%.png becomes '@id': 'Results%20and%20Diagrams/almost-50%25.png' in the RO-Crate JSON-LD.
const toValidId = text => encodeURI(text);

const toRocPerson = data => {
  const rocPerson = {};
  let dataJson = {};
  if(typeof data === 'string' || data instanceof String){
    dataJson.firstName = data.split(' ')[0];
    dataJson.lastName = data.split(' ')[1];
  } else {
    dataJson = data;
  }

  rocPerson['name'] = data.firstName+' '+data.lastName;
  rocPerson['@type'] = 'Person';
  rocPerson['@id'] = toValidId(
    data.hasOwnProperty('doi') ? data.doi : rocPerson['name']
  );

  return rocPerson;
};

const getRef = id => {
  return {'@id': typeof id==='object' ? id['@id'] : id};
};

const graph = roc['@graph'];
const addNode = obj => {
  graph[obj['@id']] = obj;
};
const rootDataEntity = graph['./'];

// name: SHOULD identify the dataset to humans well enough to disambiguate it from other RO-Crates
rootDataEntity.name = arcJSON.identifier;

// description: SHOULD further elaborate on the name to provide a summary of the context in which the dataset is important.
rootDataEntity.description = arcJSON.description;

// For a Root Data Entity, an identifier which is RECOMMENDED to be a https://doi.org/ URI.
// TODO: improve with doi
// rootDataEntity.identifier = arcJSON.identifier;

// datePublished: MUST be a string in ISO 8601 date format and SHOULD be specified to at least the precision of a day, MAY be a timestamp down to the millisecond.
rootDataEntity.datePublished = new Date(arcJSON.publicReleaseDate).toISOString();

// license: SHOULD link to a Contextual Entity in the RO-Crate Metadata File with a name and description. MAY have a URI (eg for Creative Commons or Open Source licenses). MAY, if necessary be a textual description of how the RO-Crate may be used.
rootDataEntity.license = 'TODO';

// add arc authors
for(let person of arcJSON.people){
  rootDataEntity.author.push(
    getRef(
      person.orcid ? person.orcid : `MISSING_ORCID:${person.firstName} ${person.lastName}`
    )
  );
}

// add publications
for(let publication of arcJSON.publications){
  rootDataEntity.citation.push(
    getRef(publication.doi)
  );
}

// add assays
for(let study of arcJSON.studies){
  for(let assay of study.assays){
    // TODO: filename currently encodes filepaths incorrectly via backslashes
    const id = toValidId(assay.filename.split('/')[0]);
    const rocAssay = {
      '@id': id,
      '@type': 'Dataset',
      'name': 'TODO',
      'description': 'TODO'
    };
    graph['assays/'].hasPart.push(getRef(rocAssay));
    addNode(rocAssay);
  }
}

const finalizeRoc = roc=>{
  const graphAsMap = roc['@graph'];
  const graphAsList = [];
  for(let x of Object.keys(graphAsMap))
    graphAsList.push(graphAsMap[x]);
  roc['@graph'] = graphAsList;
};
finalizeRoc(roc);

// write file
fs.writeFileSync(`${root}/ro-crate-metadata.json`, JSON.stringify(roc,null,1), 'UTF-8');