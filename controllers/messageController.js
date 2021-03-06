const Help = require("../models/Help");
const dateFormat = require("dateformat");

module.exports = {

    // Get verification that message was sent
    messageSentView: (req, res) => {
        res.render("message/message-sent");
    },
    
    // Insert new help request into database
    getHelp: (req, res, next) => {
        let helpParams = {
            subject: req.body.subject,
            email: req.body.email,
            message: req.body.message
        };
        Help.create(helpParams)
            .then(help => {
                res.locals.redirect = "/message/message-sent";
                res.locals.help = help;
                next();
            })
            .catch(error => {
                console.log(`Error sending help request: ${error.message}`);
                next(error);
            });
    },
    
    // redirect locals
    redirectView: (req, res, next) => {
        let redirectPath = res.locals.redirect;
        if (redirectPath) res.redirect(redirectPath);
        else next();
    },

    // get all tickets that are currently unresolved
    getUnresolvedTickets : (req, res, next) => {
        Help.find().where({dateResolved: null})
        .then((tickets) => {
            res.render("message/ticket-inbox", {tickets: tickets, dateFormat: dateFormat})
        }).catch((err) => {
            next(err);
        });
    },

    // get a ticket by id
    getTicketById : (req, res, next) => {
        let id = req.params.id;
        Help.findById(id)
        .then((ticket) => {
            res.render("message/show-ticket", {ticket: ticket});
        })
        .catch((err) => {
            next(err);
        });
    },

    // update a single ticket
    updateTicketById: (req, res, next) => {
        let id = req.body.id;
        Help.findByIdAndUpdate(id, {$set: {dateResolved: new Date(), notes: req.body.notes}}, {new: true})
        .then((result) => {
            console.log(result);
            res.redirect("/admin/message");
        }) .catch((err) => {
            next(err);
        });
    }
}

