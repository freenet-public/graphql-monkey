import { Chance } from 'chance';

export function generateString(name: string, chance: Chance.Chance) {
  // case: postal
  if (name.match(/postalcode|postcode|zipcode|postal|plz|zip|postleitzahl/i)) {
    return chance.zip();
  }

  // case: street name
  if (name.match(/street|straße|strasse/i)) {
    return chance.street({ country: 'us' });
  }

  // case: city
  if (name.match(/city|stadt|forCity/i)) {
    return chance.city();
  }

  // case: houseNumber
  if (name.match(/houseNumber|house/i)) {
    let houseNumber = chance.string({
      pool: '0123456789',
      length: chance.integer({ min: 1, max: 4 })
    });
    if (chance.bool()) {
      if (chance.bool()) {
        houseNumber += ' ';
      }
      houseNumber += chance.string({ pool: 'aAbBcCdDeEfF', length: 1 });
    }
    return houseNumber;
  }

  // case: lastname
  if (name.match(/lastname|familyname/i)) {
    return chance.last({ nationality: 'it' });
  }

  // case: firstname
  if (name.match(/firstname|forename/i)) {
    return chance.first({ nationality: 'us' });
  }

  // case: birthday
  if (name.match(/birthdate/i)) {
    return chance.birthday();
  }

  // case: other dates
  if (name.match(/date/i)) {
    return chance.date().toISOString();
  }
  // case: email
  if (name.match(/email/i)) {
    return chance.email();
  }

  // case: everything else
  return chance.string();
}

export function generateInteger(name: string, chance: Chance.Chance) {
  if (!name) {
    throw new Error('Never happens');
  }

  // case: limits for pagination
  if (name.match(/limit/i)) {
    return chance.integer({ min: 0, max: 20 });
  }

  // case: offsets for pagination
  if (name.match(/offset/i)) {
    return chance.integer({ min: 0, max: 20 });
  }

  return chance.integer({ min: -100, max: 100 });
}
