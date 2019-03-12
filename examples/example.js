const request = require("request-promise-native");

module.exports = { gqlm };

async function gqlm() {
  return {
    url: "https://graphql.example.com",
    count: 30,
    requestOptions: await login(),
    data: {

    },
  };
}

async function login() {
  const response = await request({
    method: "POST",
    url: "https://oauth.example.com",
    body: {
      grant_type: "password",
      client_id: "",
      client_secret: "xxx",
      username: "",
      password: "",
    },
    json: true,
  });

  return {
    headers: {
      Authorization: `Bearer ${response.access_token}`,
    },
  };
}
