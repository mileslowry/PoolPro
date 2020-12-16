const User = require("../models/Account"),
  passport = require("passport"),
  axios = require("axios"),
  httpStatus = require("http-status-codes"),
  jsonWebToken = require('jsonwebtoken'),
  dateFormat = require("dateformat"),
  Stats = require("../models/Stats"),
  getUserParams = body => {
    return {
      name: {
        first: body.first,
        last: body.last
      },
      email: body.email,
      password: body.password,
      zipCode: body.zipCode
    };
  };
const checkBool = (value) => {
  if (value == "true" || typeof value == 'object') {
    return true;
  }
  return false;
};

module.exports = {

  index: (req, res, next) => {
    User.find()
      .then(users => {
        res.locals.users = users;
        next();
      })
      .catch(error => {
        console.log(`Error fetching users: ${error.message}`);
        next(error);
      });
  },

  indexView: (req, res) => {
    res.render('admin/users');
  },

  updateUsers: async (req, res) => {
    console.log(req.body);
    try {
      let length = await req.body.length;
      for (let i = 0; i < length; i++) {
        let userId = await req.body.id[i];
        let userParams = await {
          name: {
            first: req.body.first[i],
            last: req.body.last[i]
          },
          email: req.body.email[i],
          isAdmin: checkBool(req.body.admin[i])
        };
        await User.findByIdAndUpdate(userId, {
          $set: userParams
        });
      }
      await res.redirect("/admin/users");
    } catch (error) {
      await res.redirect("/admin/users");
      console.log(error.message);
    }
  },

  update: async (req, res) => {
    try {
      let id = await req.params.id;
      let userParams = {
        name: {
          first: req.body.first,
          last: req.body.last
        },
        email: req.body.email
      };
      await User.findByIdAndUpdate(id, {
        $set: userParams
      });
      await res.redirect(`/account/${id}`);
    } catch (error) {
      res.render(error);
      console.log(error);
    };
  },

  login: (req, res) => {
    res.render("users/login");
  },

  loginOrRegister: (req, res) => {
    res.render('account/login');
  },

  loginView: (req, res) => {
    res.render('account/login');
  },

  registerView: (req, res) => {
    res.render('account/register');
  },

  //create new user
  registerUser: (req, res, next) => {
    if (req.skip) next();
    let newUser = new User(getUserParams(req.body));
    User.register(newUser, req.body.password, (error, user) => {
      if (user) {
        //req.flash("success", `${user.fullName}'s account created successfully!`);
        res.locals.redirect = "login";
        next();
      } else {
        //req.flash("error", `Failed to create user account because: ${error.message}.`);
        res.locals.redirect = "/account/register";
        next();
      }
    });
  },

  validate: async (req, res, next) => {
    await check("email").normalizeEmail({
      all_lowercase: true
    }).trim().run(req);
    await check("email", "Email is invalid").isEmail().run(req);
    await check("zipCode", "Zip code is invalid")
      .notEmpty().isInt().isLength({
        min: 5,
        max: 5
      }).equals(req.body.zipCode).run(req);
    await check("password", "Password cannot be empty").notEmpty().run(req);

    const error = validationResult(req);
    if (!error.isEmpty()) {
      let messages = error.array().map(e => e.msg);
      req.skip = true;
      req.flash("error", messages.join(" and "));
      res.locals.redirect = "/account/register";
      next();
    } else {
      next();
    }

  },

  redirectView: (req, res, next) => {
    let redirectPath = res.locals.redirect;
    if (redirectPath) res.redirect(redirectPath);
    else next();
  },

  authenticate: passport.authenticate("local", {
    failureRedirect: "/account/register",
    successRedirect: "/dashboard",
  }),

  logout: (req, res, next) => {
    req.logout();
    res.locals.redirect = "/";
    next();
  },

  viewAccount: (req, res) => {
    res.render("account/index");
  },

  editAccountView: (req, res) => {
    res.render("account/edit");
  },

  delete: (req, res, next) => {
    let userId = req.params.id;
    User.findByIdAndRemove(userId)
      .then(() => {
        res.locals.redirect = "/";
        next();
      })
      .catch(error => {
        console.log(`Error deleting account: ${error.message}`);
        next();
      });
  },

  getIPLocation: async (req, res, next) => {
    try {
      const access_key = "bad73698b87df3a6a2333502cdd9ad2c";
      const baseUrl = "http://api.ipstack.com/";
      let resp = await axios.get(`${baseUrl}check?access_key=${access_key}`);
      let location = resp.data;
      currentUserIP = {
        ip: {
          address: location.ip,
          ipType: location.type
        },
        location: {
          continent: location.continent_name,
          country: location.country_name,
          city: location.city,
          zipCode: location.zip
        }
      }
      await Stats.create(currentUserIP)
        .then(next());
    } catch (error) {
      console.log(`Error getting IP location: ${error.message}`)
    }
  },

  trackAppUse: async (req, res) => {
    try {
      let stats = await Stats.find();
      res.render("admin/app-use", {
        stats: stats,
        dateFormat: dateFormat
      });
    } catch (error) {
      console.log(`Error getting app use stats: ${error.message}`)
    }
  },

  apiAuthenticate: (req, res, next) => {
    passport.authenticate("local", (errors, user) => {
      if (user) {
        let signedToken = jsonWebToken.sign({
            data: user._id,
            exp: new Date().setDate(new Date().getDate() + 1)
          },
          "secret_encoding_passphrase"
        );

        //Check to see if req came from web app or external api call
        if (req.originalUrl === "/account/login") {
          req.session.token = signedToken;
          next();
        } else {
          res.json({
            success: true,
            token: signedToken
          });
        }
      } else
        res.json({
          success: false,
          message: "Could not authenticate user."
        });
    })(req, res, next);
  },

  verifyJWT: (req, res, next) => {
    let token = req.header("Authorization") ? req.header("Authorization").replace("Bearer ", "") : req.session.token;
    if (token) {
      jsonWebToken.verify(token, "secret_encoding_passphrase", (errors, payload) => {
        if (payload) {
          User.findById(payload.data).then(user => {
            if (user) {
              next();
            } else {
              res.status(httpStatus.FORBIDDEN).json({
                error: true,
                message: "No User account found."
              });
            }
          });
        } else {
          res.status(httpStatus.UNAUTHORIZED).json({
            error: true,
            message: "Cannot verify API token."
          });
          next();
        }
      });
    } else {
      res.status(httpStatus.UNAUTHORIZED).json({
        error: true,
        message: "Provide Token"
      });
    }
  },

  errorJSON: (error, req, res, next) => {
    let errorObject;
    if (error) {
      errorObject = {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      };
    } else {
      errorObject = {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Unknown Error."
      };
    }
    res.json(errorObject);
  },

}